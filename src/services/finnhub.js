import { getCached, setCached, memGet, memSet, clearAllCache } from './cache'

const BASE = 'https://finnhub.io/api/v1'
const KEY = import.meta.env.VITE_FINNHUB_KEY

// ─── Sliding-window rate limiter ────────────────────────────────────────────
// Finnhub free tier: 60 calls/min. We cap at 55 to leave headroom for
// WebSocket reconnects and bursts.

const MAX_PER_MINUTE = 55
const callTimes = []
let waiters = 0

function getRemaining() {
  const now = Date.now()
  while (callTimes.length && now - callTimes[0] > 60000) callTimes.shift()
  return MAX_PER_MINUTE - callTimes.length
}

function broadcastRate() {
  const remaining = getRemaining()
  window.__apiCallsRemaining = remaining
  window.__apiQueueLength = waiters
  window.dispatchEvent(new CustomEvent('apiCountUpdate', { detail: { remaining, queued: waiters } }))
}

async function acquireToken() {
  waiters++
  broadcastRate()
  try {
    while (true) {
      const now = Date.now()
      while (callTimes.length && now - callTimes[0] > 60000) callTimes.shift()
      if (callTimes.length < MAX_PER_MINUTE) {
        callTimes.push(now)
        broadcastRate()
        return
      }
      const waitMs = 60000 - (now - callTimes[0]) + 50
      await new Promise((r) => setTimeout(r, waitMs))
    }
  } finally {
    waiters--
    broadcastRate()
  }
}

// Periodic broadcast so the counter ticks up as old calls expire
setInterval(broadcastRate, 1000)

// ─── Cache TTLs by endpoint (matters a LOT for re-scan speed) ──────────────
const TTL = {
  quote: 60 * 1000, // 1 min — prices change constantly
  profile: 7 * 24 * 3600 * 1000, // 7 days — company info is static
  metrics: 24 * 3600 * 1000, // 1 day — PE, market cap shift slowly
  news: 5 * 60 * 1000, // 5 min
  earnings: 24 * 3600 * 1000, // 1 day
  splits: 30 * 24 * 3600 * 1000, // 30 days
  candles: 60 * 1000, // 1 min
  symbols: 7 * 24 * 3600 * 1000, // 7 days
}

// ─── Core fetch with two-layer cache (memory + IDB) and rate limiting ──────
async function apiGet(path, params, ttl, cacheKey) {
  // L1: in-memory
  const memHit = memGet(cacheKey)
  if (memHit !== null) return memHit

  // L2: IndexedDB
  const idbHit = await getCached(cacheKey)
  if (idbHit !== null) {
    memSet(cacheKey, idbHit, ttl)
    return idbHit
  }

  // Cold path: fetch over network
  await acquireToken()
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('token', KEY)
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }

  let attempt = 0
  while (true) {
    try {
      const res = await fetch(url.toString())
      if (res.status === 429) {
        attempt++
        if (attempt > 3) throw new Error('Rate limit exceeded')
        await new Promise((r) => setTimeout(r, 2000 * attempt))
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      memSet(cacheKey, data, ttl)
      setCached(cacheKey, data, ttl) // fire-and-forget IDB write
      return data
    } catch (e) {
      if (attempt < 2 && e.message.includes('Network')) {
        attempt++
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      throw e
    }
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export function getQuote(symbol) {
  return apiGet('/quote', { symbol }, TTL.quote, `quote:${symbol}`)
}

export function getProfile(symbol) {
  return apiGet('/stock/profile2', { symbol }, TTL.profile, `profile:${symbol}`)
}

export function getMetrics(symbol) {
  return apiGet('/stock/metric', { symbol, metric: 'all' }, TTL.metrics, `metrics:${symbol}`)
}

export function getCandles(symbol, resolution, from, to) {
  return apiGet(
    '/stock/candle',
    { symbol, resolution, from, to },
    TTL.candles,
    `candles:${symbol}:${resolution}:${from}:${to}`
  )
}

export function getNews(symbol) {
  const today = new Date().toISOString().slice(0, 10)
  return apiGet('/company-news', { symbol, from: today, to: today }, TTL.news, `news:${symbol}:${today}`)
}

export function getEarnings(from, to) {
  return apiGet('/calendar/earnings', { from, to }, TTL.earnings, `earnings:${from}:${to}`)
}

export function getSplits(symbol, from, to) {
  return apiGet('/stock/split', { symbol, from, to }, TTL.splits, `splits:${symbol}:${from}:${to}`)
}

export function getUsSymbols() {
  return apiGet('/stock/symbol', { exchange: 'US' }, TTL.symbols, 'us_symbols')
}

// ─── Today's pre-market timestamps (4:00 AM – 9:30 AM ET) ──────────────────
export function getTodayPreMarketRange() {
  const now = new Date()
  const month = now.getUTCMonth() + 1
  const isDST = month >= 3 && month <= 11
  const etOffset = isDST ? -4 : -5
  const utcOffset = -etOffset * 3600
  const etNow = new Date(now.getTime() + etOffset * 3600 * 1000)
  const dateStr = etNow.toISOString().slice(0, 10)
  const preOpen = new Date(`${dateStr}T04:00:00Z`)
  preOpen.setTime(preOpen.getTime() + utcOffset * 1000)
  const mktOpen = new Date(`${dateStr}T09:30:00Z`)
  mktOpen.setTime(mktOpen.getTime() + utcOffset * 1000)
  return {
    from: Math.floor(preOpen.getTime() / 1000),
    to: Math.floor(mktOpen.getTime() / 1000),
  }
}

export async function getPreMarketCandles(symbol) {
  const { from, to } = getTodayPreMarketRange()
  return getCandles(symbol, 1, from, to)
}

// ─── Light analysis (TV mode) — 2 Finnhub calls per symbol ─────────────────
// Used when tvData is available from the TradingView screener.
// Skips quote/profile/metrics (all in tvData) and fetches only news + splits.
// sharedEarnings is pre-fetched once for all candidates (0 extra calls).
export async function fetchLightAnalysis(symbol, existingQuote, tvData, sharedEarnings = null) {
  const yearAgoStr = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  const [news, splits] = await Promise.allSettled([
    getNews(symbol),
    getSplits(symbol, yearAgoStr, todayStr),
  ])

  // Build Finnhub-compatible profile/metrics from tvData.
  // filterDailyVolume, filterMarketCap, filterPMVolumeRatio, filterPE all read
  // these fields — keeping the same shape means no filter code changes needed.
  const profile = tvData ? {
    marketCapitalization: tvData.marketCap != null ? tvData.marketCap / 1_000_000 : null,
    finnhubIndustry: tvData.sector || '',
    exchange: tvData.exchange || '',
    name: tvData.name || symbol,
  } : null

  const metrics = tvData ? {
    metric: {
      peBasicExclExtraTTM: tvData.pe ?? null,
      peTTM: tvData.pe ?? null,
      '10DayAverageTradingVolume': tvData.avgVol10d != null ? tvData.avgVol10d / 1_000_000 : null,
    },
  } : null

  return {
    symbol,
    quote: existingQuote,
    profile,
    metrics,
    news: news.status === 'fulfilled' ? news.value : [],
    earnings: sharedEarnings,
    splits: splits.status === 'fulfilled' ? splits.value : [],
    tvData,
  }
}

// ─── Full analysis (pass 2) — 5 API calls per symbol ───────────────────────
export async function fetchFullAnalysis(symbol, existingQuote = null) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const yearAgoStr = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [quote, profile, metrics, news, earnings, splits] = await Promise.allSettled([
    existingQuote ? Promise.resolve(existingQuote) : getQuote(symbol),
    getProfile(symbol),
    getMetrics(symbol),
    getNews(symbol),
    getEarnings(todayStr, todayStr),
    getSplits(symbol, yearAgoStr, todayStr),
  ])

  return {
    symbol,
    quote: quote.status === 'fulfilled' ? quote.value : null,
    profile: profile.status === 'fulfilled' ? profile.value : null,
    metrics: metrics.status === 'fulfilled' ? metrics.value : null,
    news: news.status === 'fulfilled' ? news.value : [],
    earnings: earnings.status === 'fulfilled' ? earnings.value : null,
    splits: splits.status === 'fulfilled' ? splits.value : [],
  }
}

export { clearAllCache as clearCache }
export { getRemaining as getRemainingCalls }

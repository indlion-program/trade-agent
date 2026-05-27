const BASE = 'https://finnhub.io/api/v1'
const KEY = import.meta.env.VITE_FINNHUB_KEY

// ─── Rate limiter: 60 calls/min, 100ms minimum gap ───────────────────────────
const queue = []
let processing = false
let callCount = 0
let windowStart = Date.now()
let remainingCalls = 60

function updateRateCounter() {
  const now = Date.now()
  if (now - windowStart >= 60000) {
    callCount = 0
    windowStart = now
    remainingCalls = 60
  }
  callCount++
  remainingCalls = Math.max(0, 60 - callCount)
  window.__apiCallsRemaining = remainingCalls
  window.dispatchEvent(new CustomEvent('apiCountUpdate', { detail: remainingCalls }))
}

async function processQueue() {
  if (processing) return
  processing = true
  while (queue.length > 0) {
    const { url, resolve, reject } = queue.shift()
    updateRateCounter()
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 429) {
          // Rate limited — wait 5s then retry
          await new Promise(r => setTimeout(r, 5000))
          queue.unshift({ url, resolve, reject })
          continue
        }
        reject(new Error(`HTTP ${res.status}`))
      } else {
        const data = await res.json()
        resolve(data)
      }
    } catch (e) {
      reject(e)
    }
    await new Promise(r => setTimeout(r, 110))
  }
  processing = false
}

function enqueue(url) {
  return new Promise((resolve, reject) => {
    queue.push({ url, resolve, reject })
    processQueue()
  })
}

// ─── Cache: 60-second TTL ────────────────────────────────────────────────────
const cache = new Map()

function cached(key, fetcher, ttl = 60000) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < ttl) return Promise.resolve(entry.data)
  return fetcher().then(data => {
    cache.set(key, { data, ts: Date.now() })
    return data
  })
}

export function clearCache() {
  cache.clear()
}

// ─── API helpers ─────────────────────────────────────────────────────────────
function get(path, params = {}) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('token', KEY)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  return enqueue(url.toString())
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export function getQuote(symbol) {
  return cached(`quote:${symbol}`, () => get('/quote', { symbol }))
}

export function getProfile(symbol) {
  return cached(`profile:${symbol}`, () => get('/stock/profile2', { symbol }), 300000)
}

export function getMetrics(symbol) {
  return cached(`metrics:${symbol}`, () => get('/stock/metric', { symbol, metric: 'all' }))
}

export function getCandles(symbol, resolution, from, to) {
  return cached(
    `candles:${symbol}:${resolution}:${from}:${to}`,
    () => get('/stock/candle', { symbol, resolution, from, to })
  )
}

export function getNews(symbol) {
  const today = new Date()
  const from = today.toISOString().slice(0, 10)
  const to = from
  return cached(`news:${symbol}:${today.toDateString()}`, () =>
    get('/company-news', { symbol, from, to })
  )
}

export function getEarnings(from, to) {
  return cached(`earnings:${from}:${to}`, () =>
    get('/calendar/earnings', { from, to })
  )
}

export function getSplits(symbol, from, to) {
  return cached(`splits:${symbol}`, () =>
    get('/stock/split', { symbol, from, to })
  )
}

// ─── Today's unix timestamps for pre-market candles (4:00 AM – 9:30 AM ET) ──
export function getTodayPreMarketRange() {
  const now = new Date()
  // ET offset: standard -5h, DST -4h (rough check)
  const month = now.getUTCMonth() + 1
  const isDST = month >= 3 && month <= 11
  const etOffset = isDST ? -4 : -5
  const utcOffset = -etOffset * 3600

  // Today's date in ET
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

// ─── Fetch pre-market candles (1-min) for Fibonacci ─────────────────────────
export async function getPreMarketCandles(symbol) {
  const { from, to } = getTodayPreMarketRange()
  return getCandles(symbol, 1, from, to)
}

// ─── Get last trading day range for fallback ─────────────────────────────────
export function getLastTradingDayRange() {
  const now = new Date()
  const d = new Date(now)
  d.setDate(d.getDate() - 1)
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  const from = Math.floor(new Date(d.toISOString().slice(0, 10) + 'T14:30:00Z').getTime() / 1000)
  const to = Math.floor(new Date(d.toISOString().slice(0, 10) + 'T21:00:00Z').getTime() / 1000)
  return { from, to }
}

// ─── Batch full analysis for a symbol ───────────────────────────────────────
export async function fetchFullAnalysis(symbol) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const yearAgoStr = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [quote, profile, metrics, news, earnings, splits] = await Promise.allSettled([
    getQuote(symbol),
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

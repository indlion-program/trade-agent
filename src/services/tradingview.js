// Screener service — works on both GitHub Pages (static) and Vercel (serverless).
//
// Data source priority:
//   1. /api/screener proxy (Vercel) → tries TradingView, falls back to Yahoo
//   2. Yahoo Finance direct from browser (GitHub Pages / any static host)
//      query2.finance.yahoo.com has CORS headers that allow browser fetch

import { STRATEGY_CONFIG } from '../utils/filters'

const TV_PROXY = '/api/screener'

// ── Yahoo Finance helpers (used when proxy is unavailable) ─────────────────

function mapYahooExchange(ex) {
  if (!ex) return 'NASDAQ'
  if (ex === 'NYQ' || ex === 'NYS' || ex === 'NYSE') return 'NYSE'
  return 'NASDAQ' // NMS, NGM, NMR, NCM = NASDAQ
}

// Translate a Yahoo Finance quote object into the same column array format
// that TradingView screener returns, so normalizeItem() works unchanged.
// Column order: 0:name 1:prevClose 2:change% 3:vol 4:cap 5:sector
//               6:exchange 7:description 8:avgVol10d 9:pmChange
//               10:pmClose 11:pmHigh 12:pmLow 13:pmVolume 14:pe
function yahooToRow(q) {
  const exchange = mapYahooExchange(q.exchange ?? q.fullExchangeName)
  return {
    s: `${exchange}:${q.symbol}`,
    d: [
      q.symbol,
      q.regularMarketPreviousClose ?? q.regularMarketPrice ?? null,
      q.regularMarketChangePercent ?? null,
      q.regularMarketVolume ?? null,
      q.marketCap ?? null,
      q.sector ?? '',
      exchange,
      q.shortName ?? q.longName ?? q.symbol,
      q.averageDailyVolume10Day ?? null,
      q.preMarketChangePercent ?? null,
      q.preMarketPrice ?? null,
      null,   // pmHigh — not in Yahoo screener response
      null,   // pmLow  — not in Yahoo screener response
      q.preMarketVolume ?? null,
      q.trailingPE ?? null,
    ],
  }
}

// Fetch Yahoo Finance predefined screener directly from the browser.
// query2.finance.yahoo.com sends Access-Control-Allow-Origin: * so this
// works from any origin (GitHub Pages, localhost, etc.)
async function yahooScreen(isGapUp) {
  const scrId = isGapUp ? 'day_gainers' : 'day_losers'
  const url = `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=250&formatted=false&lang=en-US&region=US`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`)
  const json = await res.json()
  const quotes = json?.finance?.result?.[0]?.quotes ?? []
  if (!quotes.length) throw new Error('Yahoo Finance returned 0 quotes')
  return { totalCount: quotes.length, data: quotes.map(yahooToRow) }
}

// Fetch a single Yahoo Finance quote by symbol (for manual search fallback)
async function yahooSingleQuote(symbol) {
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&formatted=false&lang=en-US&region=US`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`)
  const json = await res.json()
  const q = json?.quoteResponse?.result?.[0]
  if (!q) throw new Error(`${symbol} not found`)
  return yahooToRow(q)
}

// ── Proxy + fallback ────────────────────────────────────────────────────────

// Returns parsed screener JSON in TV format.
// Tries the server proxy first; if the proxy is missing (GitHub Pages 404/405)
// or broken, falls back to calling Yahoo Finance directly from the browser.
async function postScreener(body) {
  let proxyStatus = null
  try {
    const r = await fetch(TV_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    proxyStatus = r.status
    if (r.ok) return r.json()
    // 503 = proxy ran but all upstream sources failed → don't try Yahoo again
    if (r.status === 503) {
      let detail = ''
      try { detail = (await r.json())?.error || '' } catch {}
      throw new Error(detail || 'Screener proxy: all sources unavailable')
    }
    // 404 / 405 = proxy function doesn't exist (GitHub Pages static host)
    // → fall through to direct Yahoo Finance browser call
  } catch (e) {
    // Re-throw real proxy errors, fall through for missing proxy
    if (proxyStatus === 503 || (e.message && !e.message.includes('fetch'))) throw e
  }

  // Direct Yahoo Finance from browser (works on GitHub Pages)
  const isGapUp = body?.sort?.sortOrder === 'desc'
  return yahooScreen(isGapUp)
}

// ── Column map + columns list ──────────────────────────────────────────────

const COL = {
  name:        0,
  close:       1,
  change:      2,
  volume:      3,
  marketCap:   4,
  sector:      5,
  exchange:    6,
  description: 7,
  avgVol10d:   8,
  pmChange:    9,
  pmClose:     10,
  pmHigh:      11,
  pmLow:       12,
  pmVolume:    13,
  pe:          14,
}

const COLUMNS = [
  'name', 'close', 'change', 'volume', 'market_cap_basic',
  'sector', 'exchange', 'description', 'average_volume_10d_calc',
  'premarket_change', 'premarket_close', 'premarket_high',
  'premarket_low', 'premarket_volume',
  'price_earnings_ttm',
]

function buildRequest(mode = 'gap_down', limit = 500) {
  const cfg = STRATEGY_CONFIG[mode] ?? STRATEGY_CONFIG.gap_down
  const isUp = mode === 'gap_up'
  const isPMGap = mode === 'pre_market_gap'

  const filter = [
    { left: 'close',                   operation: 'greater',  right: (cfg.minPrice ?? 5) - 1 },
    { left: 'exchange',                operation: 'in_range', right: ['NASDAQ', 'NYSE'] },
    { left: 'market_cap_basic',        operation: 'greater',  right: (cfg.minMarketCap ?? 200_000_000) * 0.5 },
    { left: 'average_volume_10d_calc', operation: 'greater',  right: (cfg.minAvgVol ?? 700_000) * 0.7 },
  ]

  if (isPMGap && cfg.minPmVol > 0) {
    filter.push({ left: 'premarket_volume', operation: 'greater', right: cfg.minPmVol * 0.5 })
  }

  return {
    filter,
    options: { lang: 'en' },
    symbols: { query: { types: ['stock', 'fund'] }, tickers: [] },
    columns: COLUMNS,
    sort: {
      sortBy: isPMGap ? 'premarket_change' : 'change',
      sortOrder: isUp ? 'desc' : 'asc',
    },
    range: [0, limit],
  }
}

function normalizeItem(item, mode) {
  const d = item.d
  const rawSymbol = item.s || ''
  const symbol = rawSymbol.includes(':') ? rawSymbol.split(':')[1] : rawSymbol

  const pmChange  = d[COL.pmChange]
  const pmClose   = d[COL.pmClose]
  const prevClose = d[COL.close]

  const dp = (pmChange != null && pmChange !== 0) ? pmChange : (d[COL.change] ?? null)

  return {
    symbol,
    exchange: d[COL.exchange] || rawSymbol.split(':')[0] || '',
    name:     d[COL.description] || symbol,
    sector:   d[COL.sector] || '',
    mode,
    quote: {
      c:  pmClose ?? prevClose,
      pc: prevClose,
      dp,
      d:  null,
      h:  d[COL.pmHigh] ?? prevClose,
      l:  d[COL.pmLow]  ?? prevClose,
      v:  d[COL.pmVolume] ?? d[COL.volume] ?? 0,
      o:  prevClose,
    },
    tvData: {
      marketCap: d[COL.marketCap],
      avgVol10d: d[COL.avgVol10d],
      pe:        d[COL.pe],
      pmHigh:    d[COL.pmHigh],
      pmLow:     d[COL.pmLow],
      pmVolume:  d[COL.pmVolume],
      prevClose,
      sector:    d[COL.sector] || '',
      exchange:  d[COL.exchange] || '',
      name:      d[COL.description] || symbol,
    },
  }
}

// ── Public exports ─────────────────────────────────────────────────────────

// Manual ticker search — proxy first, Yahoo quote fallback
export async function tvSingleStock(symbol) {
  // Try proxy
  try {
    const tickers = ['NASDAQ', 'NYSE', 'AMEX'].map(ex => `${ex}:${symbol}`)
    const body = { symbols: { query: { types: ['stock', 'fund'] }, tickers }, columns: COLUMNS, range: [0, 1] }
    const r = await fetch(TV_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) {
      const json = await r.json()
      if (json.data?.length) return normalizeItem(json.data[0], 'gap_down')
    }
    if (r.status === 503) throw new Error('Screener proxy unavailable')
    // 404/405 → fall through to Yahoo
  } catch (e) {
    if (e.message.includes('proxy')) throw e
  }

  // Direct Yahoo Finance quote
  const row = await yahooSingleQuote(symbol)
  return normalizeItem(row, 'gap_down')
}

// Main scan — returns normalized candidate list for the given strategy mode
export async function tvPreScreen(mode = 'gap_down') {
  const cfg = STRATEGY_CONFIG[mode] ?? STRATEGY_CONFIG.gap_down
  const isUp = mode === 'gap_up'
  const isPMGap = mode === 'pre_market_gap'
  const body = buildRequest(mode)

  const json = await postScreener(body)
  if (!json.data) throw new Error('Screener: unexpected response format')

  const candidates = json.data.map(item => normalizeItem(item, mode))

  return candidates.filter(({ quote, tvData }) => {
    const dp = quote.dp
    if (dp == null) return false
    if (isUp) return dp >= (cfg.minGain ?? 5) - 0.5
    if (isPMGap && tvData?.pmVolume == null) return false
    if (dp > (cfg.minDrop ?? -3) + 0.5) return false
    if (cfg.maxDrop != null && dp < cfg.maxDrop - 0.5) return false
    return true
  })
}

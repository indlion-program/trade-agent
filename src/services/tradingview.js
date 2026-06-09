// TradingView screener proxy client (pass-1 pre-screen).
//
// Calls the /api/screener serverless proxy (Vercel), which fetches the
// TradingView screener server-side (CORS + browser headers). A direct
// browser call to scanner.tradingview.com is blocked by CORS, so the proxy
// is required for this path.
//
// On a static host with no /api/screener (e.g. GitHub Pages), this throws.
// scanner.js catches that and falls back to a direct Finnhub per-symbol scan.

import { STRATEGY_CONFIG } from '../utils/filters'

const TV_PROXY = '/api/screener'

// Returns parsed screener JSON. Throws on any non-OK response (including the
// 404/405 you get when /api/screener doesn't exist on a static host).
async function postScreener(body) {
  const r = await fetch(TV_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let detail = ''
    try { detail = (await r.json())?.error || '' } catch {}
    throw new Error(`Screener HTTP ${r.status}${detail ? ` — ${detail}` : ''}`)
  }
  return r.json()
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

// Manual ticker search — tries NASDAQ, NYSE, AMEX prefixes via the proxy.
export async function tvSingleStock(symbol) {
  const tickers = ['NASDAQ', 'NYSE', 'AMEX'].map(ex => `${ex}:${symbol}`)
  const body = {
    symbols: { query: { types: ['stock', 'fund'] }, tickers },
    columns: COLUMNS,
    range: [0, 1],
  }
  const json = await postScreener(body)
  if (!json.data?.length) throw new Error(`${symbol} not found in TV screener`)
  return normalizeItem(json.data[0], 'gap_down')
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

// TradingView screener — free, no API key, returns thousands of stocks in one call.
// Used for pass-1 pre-screen instead of one Finnhub /quote call per symbol.
//
// In dev: calls /api/screener (Vercel proxy dev server via vite proxy)
// In prod: calls /api/screener (Vercel edge function)

import { STRATEGY_CONFIG } from '../utils/filters'

const TV_PROXY = '/api/screener'

// Always go through the /api/screener proxy. A direct browser call to
// scanner.tradingview.com is blocked by CORS, so there's no point trying it.
// The proxy (Vercel Edge function) handles CORS and falls back to Yahoo
// Finance if TradingView itself is unreachable.
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

// Column index map — must match the `columns` array below
const COL = {
  name:        0,
  close:       1,   // previous regular-session close (always present)
  change:      2,   // % change from prev close — always populated 24/7
  volume:      3,   // regular session volume
  marketCap:   4,
  sector:      5,
  exchange:    6,
  description: 7,
  avgVol10d:   8,
  pmChange:    9,   // pre-market % change — null outside 4–9:30 AM ET
  pmClose:     10,  // pre-market last price — null outside 4–9:30 AM ET
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

  // Server-side: filter only by always-present, reliable fields.
  // Change/PE thresholds applied client-side — TV screener returns 0
  // results when those fields are null (weekends, missing PE data).
  const filter = [
    { left: 'close',                   operation: 'greater',  right: (cfg.minPrice ?? 5) - 1 },
    { left: 'exchange',                operation: 'in_range', right: ['NASDAQ', 'NYSE'] },
    { left: 'market_cap_basic',        operation: 'greater',  right: (cfg.minMarketCap ?? 200_000_000) * 0.5 },
    { left: 'average_volume_10d_calc', operation: 'greater',  right: (cfg.minAvgVol ?? 700_000) * 0.7 },
  ]

  // pre_market_gap: require pre-market volume server-side.
  // premarket_volume is null outside 4–9:30 AM ET, so this naturally
  // returns 0 results outside pre-market hours — correct for this mode.
  if (isPMGap && cfg.minPmVol > 0) {
    filter.push({ left: 'premarket_volume', operation: 'greater', right: cfg.minPmVol * 0.5 })
  }

  return {
    filter,
    options: { lang: 'en' },
    symbols: { query: { types: ['stock', 'fund'] }, tickers: [] },
    columns: COLUMNS,
    sort: {
      // pre_market_gap sorts by premarket_change; others by regular change (works 24/7)
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

  // dp: prefer pre-market change (when available); fall back to daily change
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

// Fetch TV screener data for a single ticker (used for manual search).
// Tries NASDAQ, NYSE, AMEX prefixes and returns the first match.
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

// Returns normalized candidate objects for the given strategy mode.
export async function tvPreScreen(mode = 'gap_down') {
  const cfg = STRATEGY_CONFIG[mode] ?? STRATEGY_CONFIG.gap_down
  const isUp = mode === 'gap_up'
  const isPMGap = mode === 'pre_market_gap'
  const body = buildRequest(mode)

  const json = await postScreener(body)
  if (!json.data) throw new Error('TV screener: unexpected response format')

  const candidates = json.data.map(item => normalizeItem(item, mode))

  // Client-side change filter — reliable regardless of server-side field behavior.
  return candidates.filter(({ quote, tvData }) => {
    const dp = quote.dp
    if (dp == null) return false

    if (isUp) return dp >= (cfg.minGain ?? 5) - 0.5

    if (isPMGap) {
      // For pre_market_gap, dp must come from actual pre-market data (pmChange).
      // If pmChange is null, TV returned no pre-market data for this stock.
      const pmChange = tvData?.pmVolume != null ? quote.dp : null
      if (pmChange == null && tvData?.pmVolume == null) return false
    }

    // gap_down / pre_market_gap / earnings_down
    if (dp > (cfg.minDrop ?? -3) + 0.5) return false
    if (cfg.maxDrop != null && dp < cfg.maxDrop - 0.5) return false
    return true
  })
}

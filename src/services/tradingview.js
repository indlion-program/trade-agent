// TradingView screener — free, no API key, returns thousands of stocks in one call.
// Used for pass-1 pre-screen instead of one Finnhub /quote call per symbol.
//
// In dev: calls /api/screener (Vercel proxy dev server via vite proxy)
// In prod: calls /api/screener (Vercel edge function)

import { STRATEGY_CONFIG } from '../utils/filters'

const TV_DIRECT = 'https://scanner.tradingview.com/america/scan'
const TV_PROXY = '/api/screener'

// Try direct TV endpoint first (works on GitHub Pages if CORS allows).
// Falls back to /api/screener proxy (works on Vercel + local dev).
// If both fail, throws → scanner.js catches and switches to Finnhub pass-1.
async function postScreener(body) {
  try {
    const r = await fetch(TV_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) return r.json()
  } catch {}
  const r2 = await fetch(TV_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r2.ok) throw new Error(`TV screener HTTP ${r2.status}`)
  return r2.json()
}

// Column index map — must match the `columns` array in buildRequest()
const COL = {
  name:        0,
  close:       1,   // current price (last trade / previous close outside session)
  change:      2,   // % change from previous close — always populated, works 24/7
  volume:      3,   // regular session volume
  marketCap:   4,
  sector:      5,
  exchange:    6,
  description: 7,
  avgVol10d:   8,
  pmChange:    9,   // pre-market % change — null outside pre-market hours
  pmClose:     10,  // pre-market last price — null outside pre-market hours
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

  // DO NOT filter by `change` server-side. TV screener's `change` filter is
  // unreliable — it can return 0 results when the field is null (weekends) or
  // uses a different numeric scale than expected. Instead:
  //   1. Filter only by stable, always-present fields (price, exchange, cap, vol)
  //   2. Sort by `change` so biggest movers come first in the response
  //   3. Apply the change threshold client-side in tvPreScreen() below
  const filter = [
    { left: 'close',                   operation: 'greater',   right: (cfg.minPrice ?? 5) - 1 },
    { left: 'exchange',                operation: 'in_range',  right: ['NASDAQ', 'NYSE'] },
    { left: 'market_cap_basic',        operation: 'greater',   right: (cfg.minMarketCap ?? 500_000_000) * 0.5 },
    { left: 'average_volume_10d_calc', operation: 'greater',   right: (cfg.minAvgVol ?? 750_000) * 0.7 },
  ]

  return {
    filter,
    options: { lang: 'en' },
    symbols: { query: { types: ['stock', 'fund'] }, tickers: [] },
    columns: COLUMNS,
    sort: {
      sortBy: 'change',
      sortOrder: isUp ? 'desc' : 'asc',  // biggest movers come first
    },
    range: [0, limit],
  }
}

// Fetch TV screener data for a single ticker symbol (used for manual search).
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

  const item = json.data[0]
  const d = item.d
  const rawSymbol = item.s || ''
  const sym = rawSymbol.includes(':') ? rawSymbol.split(':')[1] : rawSymbol

  const pmChange  = d[COL.pmChange]
  const pmClose   = d[COL.pmClose]
  const prevClose = d[COL.close]

  return {
    symbol: sym,
    exchange: d[COL.exchange] || rawSymbol.split(':')[0] || '',
    name:     d[COL.description] || sym,
    sector:   d[COL.sector] || '',
    quote: {
      c:  pmClose ?? prevClose,
      pc: prevClose,
      dp: pmChange ?? d[COL.change],
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
      name:      d[COL.description] || sym,
    },
  }
}

// Returns normalized candidate objects for the given strategy mode.
export async function tvPreScreen(mode = 'gap_down') {
  const cfg = STRATEGY_CONFIG[mode] ?? STRATEGY_CONFIG.gap_down
  const isUp = mode === 'gap_up'
  const body = buildRequest(mode)

  const json = await postScreener(body)
  if (!json.data) throw new Error('TV screener: unexpected response format')

  const candidates = json.data.map((item) => {
    const d = item.d
    const rawSymbol = item.s || ''
    const symbol = rawSymbol.includes(':') ? rawSymbol.split(':')[1] : rawSymbol

    const pmChange  = d[COL.pmChange]
    const pmClose   = d[COL.pmClose]
    const prevClose = d[COL.close]
    // dp: use pre-market change when available (intraday pre-market), else daily change
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
  })

  // Client-side change filter — reliable regardless of server-side field behavior.
  return candidates.filter(({ quote }) => {
    const dp = quote.dp
    if (dp == null) return false
    if (isUp) return dp >= (cfg.minGain ?? 5) - 0.5
    // gap_down / earnings_down: enough of a drop but not a climax sell
    if (dp > (cfg.minDrop ?? -5) + 0.5) return false
    if (cfg.maxDrop != null && dp < cfg.maxDrop - 0.5) return false
    return true
  })
}

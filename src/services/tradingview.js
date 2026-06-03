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
  close:       1,   // yesterday's regular session close
  change:      2,   // % change from regular close to current (pre-market)
  volume:      3,   // yesterday's regular session volume
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
  pe:          14,  // P/E TTM — eliminates the Finnhub /stock/metric call
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

  // Pre-screen uses LOOSE thresholds to cast a wide net.
  // The strict strategy thresholds (minDrop, minPrice, etc.) are enforced in pass-2.
  const filter = [
    isUp
      ? { left: 'premarket_change', operation: 'greater', right: 4.5 }   // catch +5%+ gains
      : { left: 'premarket_change', operation: 'less',    right: -4.5 },  // catch -5%+ drops
    { left: 'close',              operation: 'greater',  right: 2 },          // > $2 (pass-2 enforces $8+)
    { left: 'premarket_volume',   operation: 'greater',  right: 30_000 },      // > 30K (pass-2 enforces 100K+)
    { left: 'exchange',           operation: 'in_range', right: ['NASDAQ', 'NYSE', 'AMEX'] },
    { left: 'market_cap_basic',   operation: 'greater',  right: 100_000_000 }, // > $100M (pass-2 enforces $1B+)
  ]

  // Exclude climax selling for gap-down modes
  if (!isUp && cfg.maxDrop !== null) {
    filter.push({ left: 'premarket_change', operation: 'greater', right: cfg.maxDrop - 0.5 })
  }

  return {
    filter,
    options: { lang: 'en' },
    symbols: { query: { types: ['stock', 'fund'] }, tickers: [] },
    columns: COLUMNS,
    sort: {
      sortBy: 'premarket_change',
      sortOrder: isUp ? 'desc' : 'asc',  // gap-up: biggest gains first
    },
    range: [0, limit],
  }
}

// Returns normalized candidate objects for the given strategy mode.
export async function tvPreScreen(mode = 'gap_down') {
  const body = buildRequest(mode)

  const json = await postScreener(body)
  if (!json.data) throw new Error('TV screener: unexpected response format')

  return json.data.map((item) => {
    const d = item.d
    const rawSymbol = item.s || ''
    const symbol = rawSymbol.includes(':') ? rawSymbol.split(':')[1] : rawSymbol

    const pmChange = d[COL.pmChange]
    const pmClose  = d[COL.pmClose]
    const prevClose = d[COL.close]

    return {
      symbol,
      exchange: d[COL.exchange] || rawSymbol.split(':')[0] || '',
      name:     d[COL.description] || symbol,
      sector:   d[COL.sector] || '',
      mode,
      quote: {
        c:  pmClose ?? prevClose,
        pc: prevClose,
        dp: pmChange,
        d:  pmChange && prevClose ? (pmChange / 100) * prevClose : null,
        h:  d[COL.pmHigh],
        l:  d[COL.pmLow],
        v:  d[COL.pmVolume],
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
        // Also store display fields so fetchLightAnalysis can build profile without Finnhub
        sector:    d[COL.sector] || '',
        exchange:  d[COL.exchange] || '',
        name:      d[COL.description] || symbol,
      },
    }
  })
}

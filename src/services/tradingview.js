// TradingView screener — free, no API key, returns thousands of stocks in one call.
// Used for pass-1 pre-screen instead of one Finnhub /quote call per symbol.
//
// In dev: calls /api/screener (Vercel proxy dev server via vite proxy)
// In prod: calls /api/screener (Vercel edge function)

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
  name: 0,       // ticker symbol without exchange prefix
  close: 1,      // yesterday's regular session close
  change: 2,     // % change from regular close to current (pre-market)
  volume: 3,     // yesterday's regular session volume
  marketCap: 4,  // market cap in $
  sector: 5,     // sector string
  exchange: 6,   // exchange (NASDAQ, NYSE, AMEX)
  description: 7, // company full name
  avgVol10d: 8,  // 10-day average volume
  pmChange: 9,   // pre-market % change
  pmClose: 10,   // pre-market last price
  pmHigh: 11,    // pre-market session high
  pmLow: 12,     // pre-market session low
  pmVolume: 13,  // pre-market session volume
}

const COLUMNS = [
  'name',
  'close',
  'change',
  'volume',
  'market_cap_basic',
  'sector',
  'exchange',
  'description',
  'average_volume_10d_calc',
  'premarket_change',
  'premarket_close',
  'premarket_high',
  'premarket_low',
  'premarket_volume',
]

function buildRequest({ minDrop = -5.0, minPrice = 3.0, minPmVol = 50000, limit = 500 } = {}) {
  return {
    filter: [
      // Pre-market change (negative = gap down). Use -4.5 to catch -5% rounded.
      { left: 'premarket_change', operation: 'less', right: minDrop + 0.5 },
      { left: 'close', operation: 'greater', right: minPrice },
      { left: 'premarket_volume', operation: 'greater', right: minPmVol },
      // Tradeable exchanges only
      { left: 'exchange', operation: 'in_range', right: ['NASDAQ', 'NYSE', 'AMEX'] },
      // Avoid penny / micro-cap trash
      { left: 'market_cap_basic', operation: 'greater', right: 100_000_000 },
    ],
    options: { lang: 'en' },
    symbols: { query: { types: ['stock', 'fund'] }, tickers: [] },
    columns: COLUMNS,
    sort: { sortBy: 'premarket_change', sortOrder: 'asc' }, // worst drops first
    range: [0, limit],
  }
}

// Returns array of normalized candidate objects, sorted by biggest pre-market drop.
export async function tvPreScreen({ minDrop = -5.0, minPrice = 3.0, minPmVol = 50000 } = {}) {
  const body = buildRequest({ minDrop, minPrice, minPmVol })

  const json = await postScreener(body)
  if (!json.data) throw new Error('TV screener: unexpected response format')

  return json.data.map((item) => {
    const d = item.d
    // item.s = "NASDAQ:AAPL" — strip exchange prefix for symbol
    const rawSymbol = item.s || ''
    const symbol = rawSymbol.includes(':') ? rawSymbol.split(':')[1] : rawSymbol

    const pmChange = d[COL.pmChange]  // pre-market % change (e.g. -7.3)
    const pmClose = d[COL.pmClose]    // pre-market last trade price
    const prevClose = d[COL.close]    // yesterday's close

    return {
      symbol,
      exchange: d[COL.exchange] || rawSymbol.split(':')[0] || '',
      name: d[COL.description] || symbol,
      sector: d[COL.sector] || '',
      // Build a quote-compatible object so existing filters work unchanged
      quote: {
        c: pmClose ?? prevClose,          // current price (pre-market)
        pc: prevClose,                    // previous close
        dp: pmChange,                     // % change (pre-market)
        d: pmChange && prevClose ? (pmChange / 100) * prevClose : null, // abs change
        h: d[COL.pmHigh],
        l: d[COL.pmLow],
        v: d[COL.pmVolume],
        o: prevClose,                     // no pre-market open in TV data
      },
      // Extra TV-only fields (used to pre-fill filters without Finnhub calls)
      tvData: {
        marketCap: d[COL.marketCap],
        avgVol10d: d[COL.avgVol10d],
        pmHigh: d[COL.pmHigh],
        pmLow: d[COL.pmLow],
        pmVolume: d[COL.pmVolume],
        prevClose,
      },
    }
  })
}

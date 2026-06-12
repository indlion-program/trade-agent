// Run by GitHub Actions (.github/workflows/scan-cron.yml) every 5 minutes
// during pre-market hours. Fetches TradingView screener data server-side
// (no CORS restrictions) and writes scan-data.json to the scan-cache branch.
// The browser app reads that file via raw.githubusercontent.com (CORS-open).

import { writeFileSync } from 'fs'

const TV_URL = 'https://scanner.tradingview.com/america/scan'

const TV_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.tradingview.com',
  'Referer': 'https://www.tradingview.com/screener/',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
}

// Column order must exactly match COLUMNS in src/services/tradingview.js
const COLUMNS = [
  'name', 'close', 'change', 'volume', 'market_cap_basic',
  'sector', 'exchange', 'description', 'average_volume_10d_calc',
  'premarket_change', 'premarket_close', 'premarket_high',
  'premarket_low', 'premarket_volume', 'price_earnings_ttm',
]

// Slightly looser than the -5% threshold — client-side filtering takes care
// of the exact cut. This gives more candidates in the cache.
const TV_BODY = {
  filter: [
    { left: 'close',                   operation: 'greater',   right: 2 },
    { left: 'exchange',                operation: 'in_range',  right: ['NASDAQ', 'NYSE'] },
    { left: 'average_volume_10d_calc', operation: 'greater',   right: 490_000 },
    { left: 'premarket_change',        operation: 'less',      right: -3 },
  ],
  options: { lang: 'en' },
  symbols: { query: { types: ['stock', 'fund'] }, tickers: [] },
  columns: COLUMNS,
  sort: { sortBy: 'premarket_change', sortOrder: 'asc' },
  range: [0, 500],
}

function mapExchange(ex) {
  if (!ex) return 'NASDAQ'
  if (ex === 'NYQ' || ex === 'NYS' || ex === 'NYSE') return 'NYSE'
  return 'NASDAQ'
}

function yahooToRow(q) {
  const exchange = mapExchange(q.exchange ?? q.fullExchangeName)
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
      null, // pmHigh unavailable
      null, // pmLow unavailable
      q.preMarketVolume ?? null,
      q.trailingPE ?? null,
    ],
  }
}

let data = null

// 1. Try TradingView
try {
  const res = await fetch(TV_URL, {
    method: 'POST',
    headers: TV_HEADERS,
    body: JSON.stringify(TV_BODY),
  })
  if (res.ok) {
    data = await res.json()
    data.source = 'tradingview'
    console.log(`TradingView: ${data.totalCount ?? 0} stocks`)
  } else {
    const text = await res.text().catch(() => '')
    console.error(`TradingView HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
} catch (e) {
  console.error('TradingView error:', e.message)
}

// 2. Yahoo Finance fallback
if (!data) {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=250&formatted=false&lang=en-US&region=US',
      { headers: { 'User-Agent': TV_HEADERS['User-Agent'], 'Accept': 'application/json' } }
    )
    if (res.ok) {
      const json = await res.json()
      const quotes = json?.finance?.result?.[0]?.quotes ?? []
      data = { totalCount: quotes.length, data: quotes.map(yahooToRow), source: 'yahoo' }
      console.log(`Yahoo Finance: ${data.totalCount} stocks`)
    } else {
      console.error(`Yahoo HTTP ${res.status}`)
    }
  } catch (e) {
    console.error('Yahoo error:', e.message)
  }
}

if (!data) {
  console.error('All sources failed — keeping existing cache.')
  process.exit(0) // exit 0 so the workflow doesn't fail noisily
}

data.fetchedAt = Date.now()
writeFileSync('scan-data.json', JSON.stringify(data))
console.log(`Saved scan-data.json (source: ${data.source}, fetchedAt: ${new Date(data.fetchedAt).toISOString()})`)

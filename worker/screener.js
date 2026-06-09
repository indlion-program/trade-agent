// Cloudflare Worker — screener proxy for GitHub Pages deployments.
//
// HOW TO DEPLOY (free, takes ~3 minutes):
//   1. Go to https://dash.cloudflare.com and sign in (free account)
//   2. Left sidebar → "Workers & Pages" → "Create application" → "Create Worker"
//   3. Give it any name (e.g. "trade-screener"), click "Deploy"
//   4. Click "Edit code", paste this entire file, click "Deploy"
//   5. Copy your Worker URL (shown at top, like https://trade-screener.xyz.workers.dev)
//   6. In your GitHub repo → Settings → Secrets → Actions, add:
//        Name:  VITE_SCREENER_PROXY
//        Value: https://trade-screener.xyz.workers.dev   (your actual URL)
//   7. Trigger a new GitHub Pages build (push any commit or click "Re-run jobs")
//
// The scanner will now call your Worker instead of /api/screener, and the
// Worker fetches TradingView (and falls back to Yahoo Finance if TV blocks).

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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function respond(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store', ...extra },
  })
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
      null,
      null,
      q.preMarketVolume ?? null,
      q.trailingPE ?? null,
    ],
  }
}

async function tryYahoo(isGapUp) {
  const scrId = isGapUp ? 'day_gainers' : 'day_losers'
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=250&formatted=false&lang=en-US&region=US`
  const res = await fetch(url, {
    headers: {
      'User-Agent': TV_HEADERS['User-Agent'],
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`)
  const json = await res.json()
  const quotes = json?.finance?.result?.[0]?.quotes ?? []
  return { totalCount: quotes.length, data: quotes.map(yahooToRow) }
}

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // Health check: GET returns status of upstream sources
    if (request.method === 'GET') {
      const probe = { worker: 'ok', ts: new Date().toISOString() }
      try {
        const tv = await fetch(TV_URL, {
          method: 'POST', headers: TV_HEADERS,
          body: JSON.stringify({ filter: [{ left: 'close', operation: 'greater', right: 5 }], columns: ['name'], range: [0, 1] }),
        })
        probe.tradingview = tv.status
      } catch (e) { probe.tradingview = `err: ${e.message}` }
      return respond(JSON.stringify(probe, null, 2))
    }

    if (request.method !== 'POST') {
      return respond(JSON.stringify({ error: 'POST required' }), 405)
    }

    const body = await request.text()
    let isGapUp = false
    try { isGapUp = JSON.parse(body).sort?.sortOrder === 'desc' } catch {}

    // 1. TradingView screener
    try {
      const tv = await fetch(TV_URL, { method: 'POST', headers: TV_HEADERS, body })
      if (tv.ok) {
        const data = await tv.text()
        return respond(data, 200, { 'X-Source': 'tradingview' })
      }
    } catch {}

    // 2. Yahoo Finance fallback
    try {
      const data = await tryYahoo(isGapUp)
      return respond(JSON.stringify(data), 200, { 'X-Source': 'yahoo' })
    } catch (e) {
      return respond(JSON.stringify({ error: `All sources unavailable: ${e.message}` }), 503)
    }
  },
}

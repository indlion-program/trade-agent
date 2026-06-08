// Vercel Edge Runtime proxy for TradingView screener.
// Edge Runtime runs on Cloudflare edge nodes (not AWS Lambda) — different IP
// ranges that are less likely to be blocked by TradingView.
//
// If TradingView still blocks (405), falls back to Yahoo Finance day screener.
export const config = { runtime: 'edge' }

// Yahoo exchange codes → TV exchange format
function mapExchange(yExchange) {
  if (!yExchange) return 'NASDAQ'
  if (yExchange === 'NYQ' || yExchange === 'NYS' || yExchange === 'NYSE') return 'NYSE'
  return 'NASDAQ' // NMS, NGM, NMR, NCM all = NASDAQ
}

// Translate Yahoo Finance screener quote → TV screener row format.
// Column order must match COL map in tradingview.js:
// 0:name 1:close(prevClose) 2:change% 3:volume 4:marketCap 5:sector
// 6:exchange 7:description 8:avgVol10d 9:pmChange 10:pmClose
// 11:pmHigh 12:pmLow 13:pmVolume 14:pe
function yahooQuoteToTVRow(q) {
  const exchange = mapExchange(q.exchange ?? q.fullExchangeName)
  return {
    s: `${exchange}:${q.symbol}`,
    d: [
      q.symbol,
      q.regularMarketPreviousClose ?? q.regularMarketPrice ?? null, // 1: prevClose
      q.regularMarketChangePercent ?? null,                          // 2: change%
      q.regularMarketVolume ?? null,                                 // 3: volume
      q.marketCap ?? null,                                           // 4: marketCap
      q.sector ?? '',                                                // 5: sector
      exchange,                                                      // 6: exchange
      q.shortName ?? q.longName ?? q.symbol,                        // 7: description
      q.averageDailyVolume10Day ?? null,                             // 8: avgVol10d
      q.preMarketChangePercent ?? null,                              // 9: pmChange
      q.preMarketPrice ?? null,                                      // 10: pmClose
      null,                                                          // 11: pmHigh (unavailable)
      null,                                                          // 12: pmLow (unavailable)
      q.preMarketVolume ?? null,                                     // 13: pmVolume
      q.trailingPE ?? null,                                          // 14: pe
    ],
  }
}

async function tryYahooFallback(isGapUp) {
  const scrId = isGapUp ? 'day_gainers' : 'day_losers'
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=250&formatted=false&lang=en-US&region=US`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)
  const json = await res.json()
  const quotes = json?.finance?.result?.[0]?.quotes ?? []
  return {
    totalCount: quotes.length,
    data: quotes.map(yahooQuoteToTVRow),
  }
}

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

export default async function handler(req) {
  // GET = health check / diagnostic. Open /api/screener in a browser to verify
  // the function is deployed and see which upstream sources are reachable.
  if (req.method === 'GET') {
    const probe = { runtime: 'edge', ts: new Date().toISOString() }
    try {
      const tv = await fetch('https://scanner.tradingview.com/america/scan', {
        method: 'POST', headers: TV_HEADERS,
        body: JSON.stringify({ filter: [{ left: 'close', operation: 'greater', right: 5 }], columns: ['name', 'close'], range: [0, 1] }),
      })
      probe.tradingview = tv.status
    } catch (e) { probe.tradingview = `err: ${e.message}` }
    try {
      const y = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=1&formatted=false&lang=en-US&region=US', {
        headers: { 'User-Agent': TV_HEADERS['User-Agent'], 'Accept': 'application/json' },
      })
      probe.yahoo = y.status
    } catch (e) { probe.yahoo = `err: ${e.message}` }
    return new Response(JSON.stringify(probe, null, 2), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Edge Runtime: read raw body directly from stream (req.text())
  const body = await req.text()

  // Determine mode from request body (for Yahoo fallback sort direction)
  let isGapUp = false
  try {
    const parsed = JSON.parse(body)
    isGapUp = parsed.sort?.sortOrder === 'desc'
  } catch {}

  // ── Try TradingView screener ──────────────────────────────────────────────
  try {
    const tvRes = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: TV_HEADERS,
      body,
    })

    if (tvRes.ok) {
      const data = await tvRes.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
          'X-Source': 'tradingview',
        },
      })
    }

    const errText = await tvRes.text().catch(() => '')
    console.error(`TV screener ${tvRes.status}: ${errText.slice(0, 200)}`)
    // Fall through to Yahoo Finance fallback
  } catch (e) {
    console.error('TV screener fetch error:', e.message)
    // Fall through to Yahoo Finance fallback
  }

  // ── Fallback: Yahoo Finance day screener ──────────────────────────────────
  // Works 24/7 during market hours. Returns biggest movers for the session.
  // Pre-market data included when available (preMarketChangePercent etc.)
  try {
    const data = await tryYahooFallback(isGapUp)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
        'X-Source': 'yahoo',
      },
    })
  } catch (e) {
    console.error('Yahoo fallback error:', e.message)
    return new Response(
      JSON.stringify({ error: `All screener sources unavailable: ${e.message}` }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

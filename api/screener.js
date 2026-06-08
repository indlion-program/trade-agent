// Vercel serverless proxy for TradingView screener.
// TradingView's scanner.tradingview.com blocks browser CORS directly,
// so we proxy through this edge function.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Read raw body from stream — avoids double-serialization issues when
  // Vercel parses req.body and we re-stringify it (can produce wrong format).
  let rawBody = ''
  try {
    rawBody = await new Promise((resolve, reject) => {
      let buf = ''
      req.on('data', chunk => { buf += chunk.toString() })
      req.on('end', () => resolve(buf))
      req.on('error', reject)
    })
  } catch {
    // Fallback: req.body already parsed by Vercel middleware
    rawBody = JSON.stringify(req.body ?? {})
  }

  if (!rawBody || rawBody === '{}') {
    return res.status(400).json({ error: 'Empty request body' })
  }

  try {
    const tvRes = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/screener/',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
      },
      body: rawBody,
    })

    if (!tvRes.ok) {
      const errText = await tvRes.text().catch(() => '')
      return res.status(tvRes.status).json({ error: `TradingView returned ${tvRes.status}`, detail: errText.slice(0, 200) })
    }

    const data = await tvRes.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

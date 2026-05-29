// Vercel serverless proxy for TradingView screener.
// TradingView's scanner.tradingview.com blocks browser CORS directly,
// so we proxy through this edge function.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const tvRes = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
      },
      body: JSON.stringify(req.body),
    })

    if (!tvRes.ok) {
      return res.status(tvRes.status).json({ error: `TradingView returned ${tvRes.status}` })
    }

    const data = await tvRes.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// Vercel serverless proxy — scrapes AmericanBulls candlestick signal for a ticker.
// AmericanBulls has no public API; we scrape HTML server-side to avoid browser CORS.
const SIGNALS = ['STRONG BUY', 'STRONG SELL', 'STAY LONG', 'STAY SHORT', 'BUY', 'SELL']

function extractSignal(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&nbsp;/g, ' ')

  for (const signal of SIGNALS) {
    const escaped = signal.replace(/\s+/g, '\\s+')
    const re = new RegExp(`>\\s*${escaped}\\s*<`, 'i')
    if (re.test(cleaned)) return signal
  }
  return null
}

export default async function handler(req, res) {
  const { ticker } = req.query
  if (!ticker || !/^[A-Za-z.]{1,7}$/.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker' })
  }

  try {
    const upstream = await fetch(
      `https://www.americanbulls.com/SignalPage.aspx?lang=en&Ticker=${encodeURIComponent(ticker.toUpperCase())}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.americanbulls.com/',
        },
      }
    )

    if (!upstream.ok) {
      return res.status(502).json({ error: `AmericanBulls returned ${upstream.status}` })
    }

    const html = await upstream.text()
    const signal = extractSignal(html)

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
    return res.status(200).json({ ticker: ticker.toUpperCase(), signal })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

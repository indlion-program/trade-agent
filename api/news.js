// Yahoo Finance RSS proxy — free, no API key, no rate limit.
// Replaces Finnhub /company-news to eliminate Finnhub quota usage for news.
// Returns [{ headline, url, datetime }] compatible with classifyNewsList().
export default async function handler(req, res) {
  const symbol = req.query?.symbol || new URL(req.url, 'http://localhost').searchParams.get('symbol')
  if (!symbol || !/^[A-Za-z0-9.\-]{1,10}$/.test(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol' })
  }

  const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol.toUpperCase())}&region=US&lang=en-US`

  try {
    const upstream = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; newsbot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    })
    if (!upstream.ok) {
      return res.status(200).json([])
    }

    const xml = await upstream.text()
    const items = []

    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = match[1]
      const headline = extractField(block, 'title')
      const url = extractField(block, 'link') || extractField(block, 'guid')
      const pubDate = extractField(block, 'pubDate')
      if (headline) {
        items.push({
          headline,
          url: url?.trim() || '',
          datetime: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0,
          source: 'Yahoo Finance',
        })
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(items)
  } catch (err) {
    return res.status(200).json([])
  }
}

function extractField(block, tag) {
  // Try CDATA first, then plain text
  const cdata = block.match(new RegExp(`<${tag}>[^<]*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>[^<]*<\\/${tag}>`))
  if (cdata) return cdata[1].trim()
  const plain = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
  if (!plain) return null
  return plain[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

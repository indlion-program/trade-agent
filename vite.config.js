import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only middleware: replicates api/news.js for local `vite dev`
function newsDevPlugin() {
  function extractField(block, tag) {
    const cdata = block.match(new RegExp(`<${tag}>[^<]*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>[^<]*<\\/${tag}>`))
    if (cdata) return cdata[1].trim()
    const plain = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
    if (!plain) return null
    return plain[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
  }
  return {
    name: 'news-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/news')) return next()
        const symbol = new URL(req.url, 'http://localhost').searchParams.get('symbol')
        if (!symbol || !/^[A-Za-z0-9.\-]{1,10}$/.test(symbol)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Invalid symbol' }))
        }
        try {
          const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol.toUpperCase())}&region=US&lang=en-US`
          const upstream = await fetch(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; newsbot/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml' },
          })
          const xml = upstream.ok ? await upstream.text() : ''
          const items = []
          for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
            const block = match[1]
            const headline = extractField(block, 'title')
            const url = extractField(block, 'link') || extractField(block, 'guid')
            const pubDate = extractField(block, 'pubDate')
            if (headline) items.push({ headline, url: url?.trim() || '', datetime: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0, source: 'Yahoo Finance' })
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(items))
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify([]))
        }
      })
    },
  }
}

// Dev-only middleware: replicates api/americanbulls.js for local `vite dev`
function americanBullsDevPlugin() {
  const SIGNALS = ['STRONG BUY', 'STRONG SELL', 'STAY LONG', 'STAY SHORT', 'BUY', 'SELL']
  function extractSignal(html) {
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/&nbsp;/g, ' ')
    for (const signal of SIGNALS) {
      const escaped = signal.replace(/\s+/g, '\\s+')
      if (new RegExp(`>\\s*${escaped}\\s*<`, 'i').test(cleaned)) return signal
    }
    return null
  }
  return {
    name: 'americanbulls-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/americanbulls')) return next()
        const qs = new URL(req.url, 'http://localhost').searchParams
        const ticker = qs.get('ticker')
        if (!ticker || !/^[A-Za-z.]{1,7}$/.test(ticker)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Invalid ticker' }))
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
          const html = await upstream.text()
          const signal = extractSignal(html)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ticker: ticker.toUpperCase(), signal }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    newsDevPlugin(),
    americanBullsDevPlugin(),
  ],
  server: {
    proxy: {
      '/api/screener': {
        target: 'https://scanner.tradingview.com',
        changeOrigin: true,
        rewrite: () => '/america/scan',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'https://www.tradingview.com')
            proxyReq.setHeader('Referer', 'https://www.tradingview.com/')
          })
        },
      },
    },
  },
})

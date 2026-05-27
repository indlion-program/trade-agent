import { classifyNews } from './newsClassifier'

// Returns { pass: bool, value: any, reason: string }
function result(pass, value, reason) {
  return { pass, value, reason }
}

// Filter 1: Pre-market drop ≤ -5%
export function filterPreMarketDrop(quote) {
  const dp = quote?.dp ?? null
  if (dp === null) return result(false, null, 'No pre-market data')
  const pass = dp <= -5.0
  return result(pass, dp, pass ? `${dp.toFixed(2)}%` : `${dp.toFixed(2)}% (needs ≤ -5%)`)
}

// Filter 2: Price > $3.00
export function filterPrice(quote) {
  const price = quote?.c ?? null
  if (price === null) return result(false, null, 'No price data')
  const pass = price > 3.0
  return result(pass, price, pass ? `$${price.toFixed(2)}` : `$${price.toFixed(2)} (needs > $3.00)`)
}

// Filter 3: Average daily volume ≥ 750,000
export function filterDailyVolume(metrics) {
  const vol = metrics?.metric?.['10DayAverageTradingVolume'] ?? null
  const volM = vol ? vol * 1_000_000 : null
  if (volM === null) return result(false, null, 'No volume data')
  const pass = volM >= 750_000
  return result(pass, volM, pass
    ? `${formatVol(volM)}`
    : `${formatVol(volM)} (needs ≥ 750K)`)
}

// Filter 4: Pre-market volume ≥ 50,000
export function filterPreMarketVolume(quote) {
  // Finnhub quote doesn't directly expose pre-market volume
  // We use today's total volume as a proxy if pre-market vol unavailable
  const vol = quote?.v ?? null
  if (vol === null) return result(false, null, 'No volume data')
  const pass = vol >= 50_000
  return result(pass, vol, pass
    ? `${formatVol(vol)} (today)`
    : `${formatVol(vol)} (needs ≥ 50K)`)
}

// Filter 5: P/E > 0
export function filterPE(metrics) {
  const pe = metrics?.metric?.peBasicExclExtraTTM ?? metrics?.metric?.peTTM ?? null
  if (pe === null) return result(false, null, 'No P/E data')
  const pass = pe > 0
  return result(pass, pe, pass ? `${pe.toFixed(1)}` : `${pe.toFixed(1)} (needs > 0, profitable)`)
}

// Filter 6: Market cap ≥ $500M
export function filterMarketCap(profile) {
  const mc = profile?.marketCapitalization ?? null
  if (mc === null) return result(false, null, 'No market cap data')
  // Finnhub returns in millions
  const mcFull = mc * 1_000_000
  const pass = mcFull >= 500_000_000
  return result(pass, mcFull, pass
    ? formatMarketCap(mcFull)
    : `${formatMarketCap(mcFull)} (needs ≥ $500M)`)
}

// Filter 7: No reverse split in past 12 months
export function filterNoReverseSplit(splits) {
  if (!Array.isArray(splits) || splits.length === 0) return result(true, null, 'No splits detected')
  const reverseSplits = splits.filter(s => {
    const ratio = s.fromFactor && s.toFactor ? s.toFactor / s.fromFactor : null
    return ratio !== null && ratio < 1.0
  })
  const pass = reverseSplits.length === 0
  if (!pass) {
    const latest = reverseSplits[0]
    return result(false, latest, `Reverse split on ${latest.date}`)
  }
  return result(true, null, 'No reverse splits in 12 months')
}

// Filter 8: Not earnings day
export function filterNotEarningsDay(earningsData, symbol) {
  if (!earningsData?.earningsCalendar) return result(true, null, 'Earnings data unavailable')
  const today = new Date().toISOString().slice(0, 10)
  const hasEarnings = earningsData.earningsCalendar.some(
    e => e.symbol === symbol && e.date === today
  )
  return result(
    !hasEarnings,
    hasEarnings,
    hasEarnings ? 'EARNINGS DAY — skip' : 'No earnings today'
  )
}

// Filter 9: Wait for first green 1-min candle (informational)
export function filterEntryTiming() {
  return result(null, null, 'Wait for first green 1-min candle after 9:30 ET')
}

// Filter 10: AmericanBulls signal (manual check)
export function filterAmericanBulls(manualChecked = null, signal = null) {
  if (signal === 'SELL' || signal === 'STRONG SELL') {
    return result(false, signal, `AmericanBulls: ${signal} — AVOID`)
  }
  if (manualChecked === false) {
    return result(null, null, 'AmericanBulls not checked yet')
  }
  if (signal) {
    return result(true, signal, `AmericanBulls: ${signal}`)
  }
  return result(null, null, 'Check AmericanBulls manually')
}

// ─── News override ───────────────────────────────────────────────────────────
export function checkNewsAvoid(news) {
  if (!Array.isArray(news)) return false
  return news.some(item => classifyNews(item.headline || item.summary || '') === 'AVOID')
}

// ─── Run all filters ─────────────────────────────────────────────────────────
export function runAllFilters(data) {
  const { symbol, quote, profile, metrics, news, earnings, splits } = data

  const f1 = filterPreMarketDrop(quote)
  const f2 = filterPrice(quote)
  const f3 = filterDailyVolume(metrics)
  const f4 = filterPreMarketVolume(quote)
  const f5 = filterPE(metrics)
  const f6 = filterMarketCap(profile)
  const f7 = filterNoReverseSplit(splits)
  const f8 = filterNotEarningsDay(earnings, symbol)
  const f9 = filterEntryTiming()
  const f10 = filterAmericanBulls()

  const newsAvoid = checkNewsAvoid(news)
  const filters = [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10]

  const hardFails = filters.filter(f => f.pass === false).length
  const warnings = filters.filter(f => f.pass === null).length

  let status = 'GREEN'
  if (newsAvoid || hardFails > 0) status = 'RED'
  else if (warnings > 0) status = 'AMBER'

  return {
    filters: {
      preMarketDrop: f1,
      price: f2,
      dailyVolume: f3,
      preMarketVolume: f4,
      pe: f5,
      marketCap: f6,
      noReverseSplit: f7,
      notEarningsDay: f8,
      entryTiming: f9,
      americanBulls: f10,
    },
    newsAvoid,
    status,
    hardFails,
    warnings,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function formatVol(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function formatMarketCap(mc) {
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(1)}B`
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(0)}M`
  return `$${mc.toFixed(0)}`
}

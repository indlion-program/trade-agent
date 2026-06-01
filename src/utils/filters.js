import { classifyNews } from './newsClassifier'

function result(pass, value, reason) {
  return { pass, value, reason }
}

// ─── Strategy config ──────────────────────────────────────────────────────────
export const STRATEGY_CONFIG = {
  gap_down: {
    label: 'Gap Down Reversal',
    minDrop: -7,
    maxDrop: -30,              // exclude climax selling
    minGain: null,
    minPrice: 8,
    minMarketCap: 1_000_000_000,
    minAvgVol: 1_500_000,
    minPmVol: 100_000,
    minPmVolRatio: 0.15,
    requireEarnings: false,
  },
  earnings_down: {
    label: 'Earnings Gap Recovery',
    minDrop: -10,
    maxDrop: -60,
    minGain: null,
    minPrice: 10,
    minMarketCap: 2_000_000_000,
    minAvgVol: 2_000_000,
    minPmVol: 200_000,
    minPmVolRatio: 0.25,
    requireEarnings: true,
  },
  gap_up: {
    label: 'Gap Up Momentum',
    minDrop: null,
    maxDrop: null,
    minGain: 7,
    minPrice: 8,
    minMarketCap: 1_000_000_000,
    minAvgVol: 1_500_000,
    minPmVol: 150_000,
    minPmVolRatio: 0.20,
    requireEarnings: false,
  },
}

// ─── Filters ──────────────────────────────────────────────────────────────────

// Filter 1: Pre-market move in the required direction
export function filterPreMarketMove(quote, cfg) {
  const dp = quote?.dp ?? null
  if (dp === null) return result(false, null, 'No pre-market data')

  if (cfg.minGain !== null) {
    // Gap-up mode
    const pass = dp >= cfg.minGain
    return result(pass, dp, pass
      ? `+${dp.toFixed(2)}%`
      : `+${dp.toFixed(2)}% (needs ≥ +${cfg.minGain}%)`)
  }

  // Gap-down mode
  const pass = dp <= cfg.minDrop
  return result(pass, dp, pass
    ? `${dp.toFixed(2)}%`
    : `${dp.toFixed(2)}% (needs ≤ ${cfg.minDrop}%)`)
}

// Filter 2: Max gap — exclude climax selling (gap_down/earnings only)
export function filterMaxGap(quote, cfg) {
  if (cfg.maxDrop === null) return result(true, null, 'No max gap check')
  const dp = quote?.dp ?? null
  if (dp === null) return result(true, null, 'No gap data')
  const pass = dp >= cfg.maxDrop
  return result(pass, dp, pass
    ? `${dp.toFixed(2)}% (within safe range)`
    : `${dp.toFixed(2)}% — climax selling, skip`)
}

// Filter 3: Price
export function filterPrice(quote, cfg) {
  const price = quote?.c ?? null
  if (price === null) return result(false, null, 'No price data')
  const pass = price >= cfg.minPrice
  return result(pass, price, pass
    ? `$${price.toFixed(2)}`
    : `$${price.toFixed(2)} (needs ≥ $${cfg.minPrice})`)
}

// Filter 4: Average daily volume
export function filterDailyVolume(metrics, cfg) {
  const vol = metrics?.metric?.['10DayAverageTradingVolume'] ?? null
  const volFull = vol ? vol * 1_000_000 : null
  if (volFull === null) return result(null, null, 'Avg volume unavailable')
  const pass = volFull >= cfg.minAvgVol
  return result(pass, volFull, pass
    ? formatVol(volFull)
    : `${formatVol(volFull)} (needs ≥ ${formatVol(cfg.minAvgVol)})`)
}

// Filter 5: Pre-market volume
export function filterPreMarketVolume(quote, cfg) {
  const vol = quote?.v ?? null
  if (vol === null) return result(null, null, 'PM volume unavailable')
  const pass = vol >= cfg.minPmVol
  return result(pass, vol, pass
    ? `${formatVol(vol)}`
    : `${formatVol(vol)} (needs ≥ ${formatVol(cfg.minPmVol)})`)
}

// Filter 6: PM Volume Ratio — PM vol vs avg daily vol (replaces P/E)
export function filterPMVolumeRatio(quote, metrics, cfg) {
  const pmVol = quote?.v ?? null
  const avgVolM = metrics?.metric?.['10DayAverageTradingVolume'] ?? null
  const avgVol = avgVolM ? avgVolM * 1_000_000 : null
  if (pmVol === null || avgVol === null || avgVol === 0) {
    return result(null, null, 'Volume ratio unavailable')
  }
  const ratio = pmVol / avgVol
  const pass = ratio >= cfg.minPmVolRatio
  const pct = (ratio * 100).toFixed(0)
  return result(pass, ratio, pass
    ? `${pct}% of avg daily vol`
    : `${pct}% (needs ≥ ${(cfg.minPmVolRatio * 100).toFixed(0)}% of avg daily vol)`)
}

// Filter 7: Market cap
export function filterMarketCap(profile, cfg) {
  const mc = profile?.marketCapitalization ?? null
  if (mc === null) return result(null, null, 'Market cap unavailable')
  const mcFull = mc * 1_000_000
  const pass = mcFull >= cfg.minMarketCap
  return result(pass, mcFull, pass
    ? formatMarketCap(mcFull)
    : `${formatMarketCap(mcFull)} (needs ≥ ${formatMarketCap(cfg.minMarketCap)})`)
}

// Filter 8: No reverse split in past 12 months
export function filterNoReverseSplit(splits) {
  if (!Array.isArray(splits) || splits.length === 0) return result(true, null, 'No splits detected')
  const reverseSplits = splits.filter(s => {
    const ratio = s.fromFactor && s.toFactor ? s.toFactor / s.fromFactor : null
    return ratio !== null && ratio < 1.0
  })
  if (reverseSplits.length > 0) {
    return result(false, reverseSplits[0], `Reverse split on ${reverseSplits[0].date}`)
  }
  return result(true, null, 'No reverse splits in 12 months')
}

// Filter 9: Earnings day — mode-aware (earnings_down requires it; others skip it)
export function filterEarningsDay(earningsData, symbol, cfg) {
  if (!earningsData?.earningsCalendar) {
    return result(cfg.requireEarnings ? null : true, null,
      cfg.requireEarnings ? 'Earnings data unavailable' : 'Earnings data unavailable')
  }
  const today = new Date().toISOString().slice(0, 10)
  const hasEarnings = earningsData.earningsCalendar.some(
    e => e.symbol === symbol && e.date === today
  )
  if (cfg.requireEarnings) {
    return result(hasEarnings, hasEarnings,
      hasEarnings ? 'Earnings today ✓ — catalyst present' : 'No earnings today — skip')
  }
  return result(!hasEarnings, hasEarnings,
    hasEarnings ? 'EARNINGS DAY — skip' : 'No earnings today')
}

// Filter 10: Entry timing (informational)
export function filterEntryTiming() {
  return result(null, null, 'Wait for first green 1-min candle after 9:30 ET')
}

// Filter 11: AmericanBulls signal
export function filterAmericanBulls(checked = null, signal = null) {
  if (signal === 'STRONG SELL') {
    return result(false, signal, 'AmericanBulls: STRONG SELL — skip')
  }
  if (signal === 'SELL') {
    return result(null, signal, 'AmericanBulls: SELL — caution, monitor closely')
  }
  if (signal) return result(true, signal, `AmericanBulls: ${signal}`)
  return result(null, null, checked === false ? 'AmericanBulls not checked' : 'Check AmericanBulls manually')
}

// Filter 12: Risk/Reward ≥ 2.0 (hard filter)
// Entry at 0.236 Fib, stop at PM Low × 0.99, target at gap fill (prevClose for gap_down)
// or ext_target2 (1.618) for gap_up.
export function filterRR(quote, cfg) {
  const pc = quote?.pc ?? null   // previous close
  const l  = quote?.l  ?? null   // today's low (PM low for gap-down)
  const h  = quote?.h  ?? null   // today's high (PM high for gap-up)
  const dp = quote?.dp ?? null

  const isUp = cfg.minGain !== null

  if (isUp) {
    // gap_up: entry at 0.618 Fib (prevClose→pmHigh), stop at 0.382, target at 1.618 ext
    if (!pc || !h || h <= pc) return result(null, null, 'Insufficient data for R/R')
    const range = h - pc
    const entry = pc + range * 0.618
    const stop  = pc + range * 0.382
    const tgt   = pc + range * 1.618
    const risk   = entry - stop
    const reward = tgt - entry
    if (risk <= 0) return result(null, null, 'R/R unavailable')
    const rr = parseFloat((reward / risk).toFixed(1))
    const pass = rr >= 2.0
    return result(pass, rr, pass
      ? `R/R 1:${rr} (entry 0.618, target ext 1.618)`
      : `R/R 1:${rr} — needs ≥ 2.0`)
  }

  // gap_down / earnings_down: entry at 0.236 Fib, stop at PM Low × 0.99, target at prevClose
  if (!pc || !l || pc <= l) return result(null, null, 'Insufficient data for R/R')
  const range = pc - l
  const entry = l + range * 0.236
  const stop  = l * 0.99
  const tgt   = pc                // full gap fill
  const risk   = entry - stop
  const reward = tgt - entry
  if (risk <= 0) return result(null, null, 'R/R unavailable')
  const rr = parseFloat((reward / risk).toFixed(1))
  const pass = rr >= 2.0
  return result(pass, rr, pass
    ? `R/R 1:${rr} (entry 0.236, target gap fill)`
    : `R/R 1:${rr} — needs ≥ 2.0`)
}

// ─── News override ────────────────────────────────────────────────────────────
export function checkNewsAvoid(news) {
  if (!Array.isArray(news)) return false
  return news.some(item => classifyNews(item.headline || item.summary || '') === 'AVOID')
}

// ─── Confidence score (0–100) ─────────────────────────────────────────────────
export function computeScore(filters, quote, mode = 'gap_down') {
  if (!filters) return 0

  const hardFilterKeys = ['preMarketMove', 'maxGap', 'price', 'dailyVolume',
    'preMarketVolume', 'pmVolumeRatio', 'marketCap', 'noReverseSplit',
    'notEarningsDay', 'riskReward']
  const anyHardFail = hardFilterKeys.some(k => filters[k]?.pass === false)
  if (anyHardFail) return 0

  let score = 30   // base: all hard filters pass

  // PM Volume Ratio (0–20 pts)
  const ratio = filters.pmVolumeRatio?.value ?? null
  if (ratio !== null) {
    if (ratio >= 0.50) score += 20
    else if (ratio >= 0.25) score += 12
    else if (ratio >= 0.15) score += 6
  }

  // R/R (0–20 pts)
  const rr = filters.riskReward?.value ?? null
  if (rr !== null) {
    if (rr >= 3.0) score += 20
    else if (rr >= 2.0) score += 10
  }

  // Gap sweet spot (0–15 pts): ±7–20% ideal
  const dp = quote?.dp ?? null
  if (dp !== null) {
    const absDp = Math.abs(dp)
    if (absDp >= 7 && absDp <= 20) score += 15
    else if (absDp >= 5 && absDp < 7) score += 5
  }

  // AmericanBulls bonus (0–10 pts)
  const abSignal = filters.americanBulls?.value ?? null
  if (abSignal === 'STRONG BUY' || abSignal === 'BUY') score += 10
  else if (abSignal === 'STAY LONG' || abSignal === 'STAY SHORT') score += 5

  // Market cap tier (0–5 pts)
  const mc = filters.marketCap?.value ?? null
  if (mc !== null && mc >= 10_000_000_000) score += 5

  return Math.min(100, score)
}

// ─── Run all filters ──────────────────────────────────────────────────────────
export function runAllFilters(data, mode = 'gap_down') {
  const { symbol, quote, profile, metrics, news, earnings, splits } = data
  const cfg = STRATEGY_CONFIG[mode] ?? STRATEGY_CONFIG.gap_down

  const f1  = filterPreMarketMove(quote, cfg)
  const f2  = filterMaxGap(quote, cfg)
  const f3  = filterPrice(quote, cfg)
  const f4  = filterDailyVolume(metrics, cfg)
  const f5  = filterPreMarketVolume(quote, cfg)
  const f6  = filterPMVolumeRatio(quote, metrics, cfg)
  const f7  = filterMarketCap(profile, cfg)
  const f8  = filterNoReverseSplit(splits)
  const f9  = filterEarningsDay(earnings, symbol, cfg)
  const f10 = filterEntryTiming()
  const f11 = filterAmericanBulls()
  const f12 = filterRR(quote, cfg)

  const newsAvoid = checkNewsAvoid(news)
  const allFilters = [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12]

  const hardFails = allFilters.filter(f => f.pass === false).length
  const warnings  = allFilters.filter(f => f.pass === null).length

  let status = 'GREEN'
  if (newsAvoid || hardFails > 0) status = 'RED'
  else if (warnings > 0) status = 'AMBER'

  const filtersMap = {
    preMarketMove:  f1,
    maxGap:         f2,
    price:          f3,
    dailyVolume:    f4,
    preMarketVolume: f5,
    pmVolumeRatio:  f6,
    marketCap:      f7,
    noReverseSplit: f8,
    notEarningsDay: f9,
    entryTiming:    f10,
    americanBulls:  f11,
    riskReward:     f12,
  }

  const score = computeScore(filtersMap, quote, mode)

  return { filters: filtersMap, newsAvoid, status, hardFails, warnings, score, mode }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatVol(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function formatMarketCap(mc) {
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(1)}B`
  if (mc >= 1_000_000)     return `$${(mc / 1_000_000).toFixed(0)}M`
  return `$${mc.toFixed(0)}`
}

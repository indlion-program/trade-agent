// Pure Fibonacci calculator for gap-reversal strategy

const LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
const LABELS = {
  0: 'Pre-market Low',
  0.236: 'Early Resistance',
  0.382: 'Entry Zone',
  0.5: 'Mid Target',
  0.618: 'Main Target',
  0.786: 'Stretch Target',
  1.0: 'Pre-market High',
}

const ROLES = {
  0: 'stop',
  0.236: 'resistance',
  0.382: 'entry',
  0.5: 'target1',
  0.618: 'target2',
  0.786: 'target3',
  1.0: 'full_fill',
}

export function calculateFibLevels(preMarketHigh, preMarketLow) {
  if (!preMarketHigh || !preMarketLow || preMarketHigh <= preMarketLow) return null
  const range = preMarketHigh - preMarketLow

  const levels = LEVELS.map(ratio => ({
    ratio,
    label: LABELS[ratio],
    role: ROLES[ratio],
    price: parseFloat((preMarketLow + range * ratio).toFixed(2)),
  }))

  const entry = levels.find(l => l.role === 'entry')
  const target = levels.find(l => l.role === 'target2')
  const stopLoss = parseFloat((preMarketLow * 0.985).toFixed(2)) // -1.5%

  const risk = entry ? entry.price - stopLoss : null
  const reward = entry && target ? target.price - entry.price : null
  const rrRatio = risk && reward && risk > 0 ? parseFloat((reward / risk).toFixed(1)) : null

  return {
    levels,
    preMarketHigh,
    preMarketLow,
    range,
    stopLoss,
    entryPrice: entry?.price ?? null,
    target1: levels.find(l => l.role === 'target1')?.price ?? null,
    target2: levels.find(l => l.role === 'target2')?.price ?? null,
    target3: levels.find(l => l.role === 'target3')?.price ?? null,
    riskReward: rrRatio,
    rrValid: rrRatio !== null && rrRatio >= 2.0,
  }
}

// Derive pre-market high/low from 1-min candles
export function extractPreMarketHL(candleData) {
  if (!candleData || candleData.s === 'no_data' || !candleData.h) return null
  const { h, l } = candleData
  if (!Array.isArray(h) || !Array.isArray(l) || !h.length || !l.length) return null
  return {
    high: Math.max(...h),
    low: Math.min(...l),
  }
}

// Fallback: derive pre-market range from /quote response.
// During pre-market hours, `h` and `l` reflect the pre-market session.
// During regular hours they reflect intraday range, which is a rough proxy.
export function extractPreMarketHLFromQuote(quote) {
  if (!quote) return null
  const high = quote.h
  const low = quote.l
  if (!high || !low || high <= low) return null
  return { high, low }
}

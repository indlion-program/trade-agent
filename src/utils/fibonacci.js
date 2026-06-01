// Gap-reversal / gap-continuation Fibonacci calculator
// gap_down (default): high=prevClose, low=pmLow → entry at 0.236, targets upward to full fill
// gap_up:             high=pmHigh,    low=prevClose → entry at 0.618 pullback, targets via extensions

const BASE_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
const EXT_LEVELS  = [1.272, 1.618]

const LABELS_DOWN = {
  0:     'Pre-market Low',
  0.236: 'Entry Zone',
  0.382: 'First Target',
  0.5:   'Mid Target',
  0.618: 'Main Target',
  0.786: 'Stretch Target',
  1.0:   'Gap Fill (Prev Close)',
  1.272: 'Extension T1',
  1.618: 'Extension T2',
}

const LABELS_UP = {
  0:     'Prev Close (Gap Floor)',
  0.236: 'Danger Zone',
  0.382: 'Stop Level',
  0.5:   'Support',
  0.618: 'Entry Zone',
  0.786: 'Tight Entry',
  1.0:   'PM High (Breakout)',
  1.272: 'Extension T1',
  1.618: 'Extension T2',
}

const ROLES_DOWN = {
  0:     'stop',
  0.236: 'entry',
  0.382: 'target1',
  0.5:   'mid',
  0.618: 'target2',
  0.786: 'target3',
  1.0:   'full_fill',
  1.272: 'ext_target1',
  1.618: 'ext_target2',
}

const ROLES_UP = {
  0:     'gap_floor',
  0.236: 'danger',
  0.382: 'stop',
  0.5:   'support',
  0.618: 'entry',
  0.786: 'tight_entry',
  1.0:   'breakout',
  1.272: 'ext_target1',
  1.618: 'ext_target2',
}

export function calculateFibLevels(high, low, { extensions = false, mode = 'gap_down' } = {}) {
  if (!high || !low || high <= low) return null
  const range = high - low
  const isUp = mode === 'gap_up'
  const LABELS = isUp ? LABELS_UP : LABELS_DOWN
  const ROLES  = isUp ? ROLES_UP  : ROLES_DOWN

  const ratios = [...BASE_LEVELS, ...(extensions ? EXT_LEVELS : [])]
  const levels = ratios.map(ratio => ({
    ratio,
    label: LABELS[ratio] ?? `${ratio.toFixed(3)}`,
    role:  ROLES[ratio]  ?? 'extension',
    price: parseFloat((low + range * ratio).toFixed(2)),
    isExtension: ratio > 1.0,
  }))

  const entryLevel = levels.find(l => l.role === 'entry')
  const entryPrice = entryLevel?.price ?? null

  // Stop: gap_down → 1% below PM Low; gap_up → the 0.382 Fib level
  const stopLoss = isUp
    ? levels.find(l => l.ratio === 0.382)?.price ?? null
    : entryPrice !== null ? parseFloat((low * 0.99).toFixed(2)) : null

  // R/R target: gap_down → full gap fill (1.0); gap_up → 1.618 extension
  const rrTargetRole = isUp ? 'ext_target2' : 'full_fill'
  const rrTarget = levels.find(l => l.role === rrTargetRole)?.price ?? null

  const risk   = entryPrice !== null && stopLoss !== null ? entryPrice - stopLoss : null
  const reward = entryPrice !== null && rrTarget  !== null ? rrTarget - entryPrice : null
  const rrRatio = risk && reward && risk > 0 ? parseFloat((reward / risk).toFixed(1)) : null

  return {
    levels,
    preMarketHigh: high,
    preMarketLow:  low,
    range,
    mode,
    stopLoss,
    entryPrice,
    target1:    levels.find(l => l.role === (isUp ? 'ext_target1' : 'target1'))?.price ?? null,
    target2:    levels.find(l => l.role === (isUp ? 'ext_target2' : 'target2'))?.price ?? null,
    target3:    levels.find(l => l.role === 'target3')?.price ?? null,
    fullFill:   levels.find(l => l.role === 'full_fill')?.price ?? null,
    extTarget1: levels.find(l => l.role === 'ext_target1')?.price ?? null,
    extTarget2: levels.find(l => l.role === 'ext_target2')?.price ?? null,
    riskReward: rrRatio,
    rrValid: rrRatio !== null && rrRatio >= 2.0,
  }
}

// Derive pre-market high/low from 1-min candles (paid Finnhub tier)
export function extractPreMarketHL(candleData) {
  if (!candleData || candleData.s === 'no_data' || !candleData.h) return null
  const { h, l } = candleData
  if (!Array.isArray(h) || !Array.isArray(l) || !h.length || !l.length) return null
  return { high: Math.max(...h), low: Math.min(...l) }
}

// Kept for reference — no longer used for Fibonacci anchor
export function extractPreMarketHLFromQuote(quote) {
  if (!quote) return null
  const high = quote.h
  const low  = quote.l
  if (!high || !low || high <= low) return null
  return { high, low }
}

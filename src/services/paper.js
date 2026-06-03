// Paper trading service — versioned localStorage persistence.
// KEY MUST NEVER CHANGE — changing it would wipe all user data.
const KEY = 'paper-portfolio-v2'

const DEFAULT_STATE = {
  schemaVersion: 3,
  cash: 20000,
  positions: [],
  pendingOrders: [],   // limit orders waiting to be filled
  history: [],
  notifyTopic: '',
  totalDeposited: 20000,
}

// ─── Load / Save ─────────────────────────────────────────────────────────────

function migrate(raw) {
  if (!raw.schemaVersion) {
    raw.schemaVersion = 2
    raw.totalDeposited = raw.totalDeposited ?? 20000
    raw.notifyTopic = raw.notifyTopic ?? ''
    raw.positions = (raw.positions || []).map(p => ({
      ...p, sharesOpen: p.sharesOpen ?? p.shares, hitTargets: p.hitTargets ?? [],
    }))
  }
  if (raw.schemaVersion < 3) {
    raw.schemaVersion = 3
    raw.pendingOrders = raw.pendingOrders ?? []
  }
  return raw
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    return migrate(parsed)
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  window.dispatchEvent(new CustomEvent('portfolioChange'))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPortfolio() {
  return load()
}

export function buyPosition(symbol, entryPrice, shares, fibData, mode) {
  const state = load()
  const cost = parseFloat((entryPrice * shares).toFixed(2))
  if (cost > state.cash) return { ok: false, error: 'Insufficient cash' }

  const position = {
    id: String(Date.now()),
    symbol,
    mode: mode || 'gap_down',
    entryPrice: parseFloat(entryPrice.toFixed(2)),
    shares,
    sharesOpen: shares,
    cost,
    stopLoss: fibData?.stopLoss ?? null,
    target1:  fibData?.target1  ?? null,
    target2:  fibData?.target2  ?? null,
    fullFill: fibData?.fullFill ?? null,
    openedAt: Date.now(),
    hitTargets: [],
  }

  state.cash = parseFloat((state.cash - cost).toFixed(2))
  state.positions.push(position)
  save(state)
  return { ok: true, position }
}

export function sellPartial(id, exitPrice, reason) {
  const state = load()
  const pos = state.positions.find(p => p.id === id)
  if (!pos) return

  const soldShares = Math.max(1, Math.floor(pos.sharesOpen / 2))
  const proceeds   = parseFloat((soldShares * exitPrice).toFixed(2))
  const costBasis  = parseFloat((soldShares * pos.entryPrice).toFixed(2))
  const pnl        = parseFloat((proceeds - costBasis).toFixed(2))
  const pnlPct     = parseFloat(((pnl / costBasis) * 100).toFixed(2))

  pos.sharesOpen -= soldShares
  pos.hitTargets.push(reason)
  state.cash = parseFloat((state.cash + proceeds).toFixed(2))

  // Add a partial history entry
  state.history.unshift({
    id: `${id}-${reason}`,
    symbol: pos.symbol,
    entryPrice: pos.entryPrice,
    exitPrice: parseFloat(exitPrice.toFixed(2)),
    shares: soldShares,
    pnl,
    pnlPct,
    openedAt: pos.openedAt,
    closedAt: Date.now(),
    closeReason: reason,
    partial: true,
  })

  save(state)
}

export function sellAll(id, exitPrice, reason) {
  const state = load()
  const idx = state.positions.findIndex(p => p.id === id)
  if (idx === -1) return

  const pos      = state.positions[idx]
  const proceeds = parseFloat((pos.sharesOpen * exitPrice).toFixed(2))
  const costBasis= parseFloat((pos.sharesOpen * pos.entryPrice).toFixed(2))
  const pnl      = parseFloat((proceeds - costBasis).toFixed(2))
  const pnlPct   = parseFloat(((pnl / costBasis) * 100).toFixed(2))

  state.cash = parseFloat((state.cash + proceeds).toFixed(2))
  state.positions.splice(idx, 1)

  state.history.unshift({
    id,
    symbol: pos.symbol,
    entryPrice: pos.entryPrice,
    exitPrice: parseFloat(exitPrice.toFixed(2)),
    shares: pos.sharesOpen,
    pnl,
    pnlPct,
    openedAt: pos.openedAt,
    closedAt: Date.now(),
    closeReason: reason,
    partial: false,
  })

  save(state)
}

// ─── Limit orders ─────────────────────────────────────────────────────────────

// Create a pending limit order. Cash is reserved immediately.
// direction: 'up' = fill when price rises to limitPrice (gap-down entry)
//            'down' = fill when price falls to limitPrice (gap-up pullback entry)
export function setLimitBuy(symbol, limitPrice, shares, fibData, mode) {
  const state = load()
  const reserved = parseFloat((limitPrice * shares).toFixed(2))
  if (reserved > state.cash) return { ok: false, error: 'Insufficient cash' }

  state.pendingOrders = state.pendingOrders || []
  state.pendingOrders.push({
    id: String(Date.now()),
    symbol,
    mode: mode || 'gap_down',
    limitPrice: parseFloat(limitPrice.toFixed(2)),
    shares,
    reserved,
    fibData,
    createdAt: Date.now(),
    direction: mode === 'gap_up' ? 'down' : 'up',
  })
  state.cash = parseFloat((state.cash - reserved).toFixed(2))
  save(state)
  return { ok: true }
}

// Cancel a pending order — refunds reserved cash.
export function cancelLimitOrder(id) {
  const state = load()
  state.pendingOrders = state.pendingOrders || []
  const idx = state.pendingOrders.findIndex(o => o.id === id)
  if (idx === -1) return
  state.cash = parseFloat((state.cash + state.pendingOrders[idx].reserved).toFixed(2))
  state.pendingOrders.splice(idx, 1)
  save(state)
}

// Execute a pending order at the actual fill price (triggered by price monitor).
export function executeLimitOrder(id, fillPrice) {
  const state = load()
  state.pendingOrders = state.pendingOrders || []
  const idx = state.pendingOrders.findIndex(o => o.id === id)
  if (idx === -1) return null
  const order = state.pendingOrders[idx]

  // Refund difference if filled at better price (slippage credit or debit)
  const actualCost = parseFloat((fillPrice * order.shares).toFixed(2))
  const diff = parseFloat((order.reserved - actualCost).toFixed(2))
  state.cash = parseFloat((state.cash + diff).toFixed(2))

  const position = {
    id: `${id}-fill`,
    symbol: order.symbol,
    mode: order.mode,
    entryPrice: parseFloat(fillPrice.toFixed(2)),
    shares: order.shares,
    sharesOpen: order.shares,
    cost: actualCost,
    stopLoss:  order.fibData?.stopLoss  ?? null,
    target1:   order.fibData?.target1   ?? null,
    target2:   order.fibData?.target2   ?? null,
    fullFill:  order.fibData?.fullFill  ?? null,
    openedAt:  Date.now(),
    hitTargets: [],
    filledFromLimit: true,
  }
  state.positions.push(position)
  state.pendingOrders.splice(idx, 1)
  save(state)
  return position
}

export function setNotifyTopic(topic) {
  const state = load()
  state.notifyTopic = topic.trim()
  save(state)
}

// Called ONLY from explicit user confirmation UI
export function resetPortfolio() {
  save({ ...DEFAULT_STATE })
}

// Equity = cash + unrealised value of open positions
// Pass livePrices: { AAPL: 312.50, ... }
export function calcEquity(livePrices = {}) {
  const state = load()
  const invested = state.positions.reduce((sum, p) => {
    const price = livePrices[p.symbol] ?? p.entryPrice
    return sum + p.sharesOpen * price
  }, 0)
  return {
    cash:      state.cash,
    invested:  parseFloat(invested.toFixed(2)),
    total:     parseFloat((state.cash + invested).toFixed(2)),
    deposited: state.totalDeposited,
    pnl:       parseFloat((state.cash + invested - state.totalDeposited).toFixed(2)),
  }
}

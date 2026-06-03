// Notification service — three layers, all free:
//   1. In-app toast (always works)
//   2. Browser Notification API (desktop + Android Chrome)
//   3. ntfy.sh HTTP POST (iOS + Android via free ntfy app)

const NTFY_TOPIC = 'trade-agent'

// In-app toast callbacks — components register here
const toastListeners = new Set()

export function onToast(cb) {
  toastListeners.add(cb)
  return () => toastListeners.delete(cb)
}

function fireToast(title, body, type = 'info') {
  for (const cb of toastListeners) cb({ title, body, type })
}

async function browserNotify(title, body) {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        silent: false,
      })
    }
  } catch {
    // Notification API not available (e.g. in some iframes)
  }
}

async function ntfyNotify(title, body, priority = 'default', tags = 'chart_with_upwards_trend') {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      body,
      headers: {
        Title: title,
        Priority: priority,
        Tags: tags,
      },
    })
  } catch {
    // Network error — silently ignore
  }
}

async function notify(title, body, { type = 'info', priority = 'default', tags = 'chart_with_upwards_trend' } = {}) {
  fireToast(title, body, type)
  await Promise.all([
    browserNotify(title, body),
    ntfyNotify(title, body, priority, tags),
  ])
}

// ─── Specific trade alerts ────────────────────────────────────────────────────

export async function alertGreenStock(symbol, dp, fib = null) {
  const dpStr = dp != null ? ` (${dp > 0 ? '+' : ''}${dp.toFixed(1)}%)` : ''
  const parts = []
  if (fib?.entryPrice) parts.push(`Entry: $${fib.entryPrice.toFixed(2)}`)
  if (fib?.stopLoss)   parts.push(`Stop: $${fib.stopLoss.toFixed(2)}`)
  if (fib?.target2)    parts.push(`T2: $${fib.target2.toFixed(2)}`)
  const body = `All filters GREEN.${parts.length ? ' ' + parts.join(' | ') : ''}`
  await notify(`BUY SIGNAL: ${symbol}${dpStr}`, body, {
    type: 'green', priority: 'high', tags: 'white_check_mark,rocket',
  })
}

export async function alertStopLoss(symbol, price, stopLevel) {
  await notify(
    `STOP LOSS: ${symbol}`,
    `Price $${price.toFixed(2)} hit stop at $${stopLevel.toFixed(2)}. Exit position.`,
    { type: 'stop', priority: 'urgent', tags: 'warning,red_circle' },
  )
}

export async function alertTakeProfit(symbol, price, targetLabel, targetPrice, isPartial = false) {
  const action = isPartial ? 'Consider partial exit.' : 'Consider full exit.'
  await notify(
    `TAKE PROFIT: ${symbol} — ${targetLabel}`,
    `Price $${price.toFixed(2)} reached $${targetPrice.toFixed(2)}. ${action}`,
    { type: 'profit', priority: 'high', tags: 'moneybag,chart_with_upwards_trend' },
  )
}

export async function alertAvoidNews(symbol, headline) {
  await notify(
    `AVOID NEWS: ${symbol}`,
    `Fundamental damage detected: "${headline}"`,
    { type: 'avoid', priority: 'default', tags: 'x,newspaper' },
  )
}

// ─── Utility ─────────────────────────────────────────────────────────────────

// Backward-compat wrapper used by settings UI
export async function sendTradeAlert({ title, body, type = 'info' }) {
  const priority = type === 'stop' ? 'high' : 'default'
  await notify(title, body, { type, priority })
}

// Test alert — topic param kept for backward compat but ignored
export async function sendTestAlert(_topic) {
  await notify(
    'Test — Trade Scanner Active',
    'Push notifications are working. You will receive alerts for GREEN stocks, stop losses, and targets.',
    { type: 'info', priority: 'default', tags: 'bell' },
  )
}

export async function requestBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function getBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

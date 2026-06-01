// Notification service — three layers, all free:
//   1. In-app toast (always works)
//   2. Browser Notification API (desktop + Android Chrome)
//   3. ntfy.sh HTTP POST (iOS + Android via free ntfy app)

// In-app toast callbacks — components register here
const toastListeners = new Set()

export function onToast(cb) {
  toastListeners.add(cb)
  return () => toastListeners.delete(cb)
}

function fireToast(title, body, type = 'info') {
  for (const cb of toastListeners) cb({ title, body, type })
}

// Browser Notification API
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

// ntfy.sh — free push to phone
async function ntfyNotify(topic, title, body, priority = 'default') {
  if (!topic) return
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body,
      headers: {
        Title: title,
        Priority: priority,
        Tags: priority === 'high' ? 'warning,chart_with_upwards_trend' : 'chart_with_upwards_trend',
      },
    })
  } catch {
    // Network error — silently ignore (don't crash trade logic)
  }
}

// ─── Main alert function ──────────────────────────────────────────────────────

export async function sendTradeAlert({ title, body, type = 'info', topic = '' }) {
  const priority = type === 'stop' ? 'high' : 'default'
  fireToast(title, body, type)
  await Promise.all([
    browserNotify(title, body),
    ntfyNotify(topic, title, body, priority),
  ])
}

// Test notification (from settings UI)
export async function sendTestAlert(topic) {
  await sendTradeAlert({
    title: '🔔 Trade Scanner — Test',
    body: 'Notifications are working! You will receive alerts when targets are hit.',
    type: 'info',
    topic,
  })
}

// Request browser notification permission explicitly
export async function requestBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function getBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

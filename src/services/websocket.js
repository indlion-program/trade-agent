const WS_URL = `wss://ws.finnhub.io?token=${import.meta.env.VITE_FINNHUB_KEY}`

let ws = null
let subscribers = {}  // symbol → Set of callbacks
let subscribed = new Set()
let reconnectTimer = null
let pingTimer = null

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    // Re-subscribe all active symbols
    for (const symbol of subscribed) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol }))
    }
    // Keepalive ping every 25s
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type !== 'trade' || !msg.data) return
      for (const trade of msg.data) {
        const cbs = subscribers[trade.s]
        if (cbs) {
          for (const cb of cbs) cb(trade.p, trade.v, trade.t)
        }
      }
    } catch {}
  }

  ws.onclose = () => {
    clearInterval(pingTimer)
    if (subscribed.size > 0) {
      reconnectTimer = setTimeout(connect, 3000)
    }
  }

  ws.onerror = () => {
    ws.close()
  }
}

function disconnect() {
  clearTimeout(reconnectTimer)
  clearInterval(pingTimer)
  if (ws) {
    ws.close()
    ws = null
  }
}

export function subscribeTicker(symbol, callback) {
  if (!subscribers[symbol]) subscribers[symbol] = new Set()
  subscribers[symbol].add(callback)
  subscribed.add(symbol)

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect()
  } else {
    ws.send(JSON.stringify({ type: 'subscribe', symbol }))
  }

  return () => {
    subscribers[symbol]?.delete(callback)
    if (subscribers[symbol]?.size === 0) {
      delete subscribers[symbol]
      subscribed.delete(symbol)
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbol }))
      }
      if (subscribed.size === 0) disconnect()
    }
  }
}

export function getWsStatus() {
  if (!ws) return 'disconnected'
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting'
    case WebSocket.OPEN: return 'connected'
    default: return 'disconnected'
  }
}

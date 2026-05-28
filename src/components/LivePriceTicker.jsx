import { useLivePrice } from '../hooks/useLivePrice'

export function LivePriceTicker({ symbol, initialPrice, initialChange }) {
  const { price, change, wsStatus } = useLivePrice(symbol, initialPrice)

  const statusDot = {
    connected: '#22c55e',
    connecting: '#f59e0b',
    disconnected: '#ef4444',
  }[wsStatus] || '#64748b'

  const flashClass = change === 'up' ? 'flash-green' : change === 'down' ? 'flash-red' : ''
  const priceColor = change === 'up' ? '#22c55e' : change === 'down' ? '#ef4444' : '#f1f5f9'

  return (
    <div
      className={`rounded-xl border p-4 ${flashClass}`}
      style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color: '#64748b', letterSpacing: '0.06em' }}>
          LIVE PRICE
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusDot, boxShadow: wsStatus === 'connected' ? `0 0 6px ${statusDot}` : 'none' }}
          />
          <span className="text-xs" style={{ color: '#64748b' }}>
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <span
          className="text-4xl font-bold font-mono tabular-nums transition-colors duration-200"
          style={{ color: priceColor }}
        >
          {price !== null ? `$${price.toFixed(2)}` : '—'}
        </span>
        {initialChange !== null && initialChange !== undefined && (
          <span
            className="text-xl font-semibold tabular-nums"
            style={{ color: initialChange <= 0 ? '#ef4444' : '#22c55e' }}
          >
            {initialChange > 0 ? '+' : ''}{initialChange.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="text-xs mt-1" style={{ color: '#64748b' }}>
        {symbol} • WebSocket stream
      </div>
    </div>
  )
}

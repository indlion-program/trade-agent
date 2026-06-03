import { useState } from 'react'
import { buyPosition, setLimitBuy, getPortfolio } from '../services/paper'

export function BuyModal({ stockData, fib, onClose, onBought }) {
  const { symbol, mode } = stockData
  const isUp = mode === 'gap_up'

  const suggestedEntry = fib?.entryPrice ?? stockData.quote?.c ?? 0
  const stopLoss   = fib?.stopLoss   ?? null
  const target1    = fib?.target1    ?? null
  const target2    = fib?.target2    ?? null
  const fullFill   = fib?.fullFill   ?? null
  const rr         = fib?.riskReward ?? null

  const portfolio     = getPortfolio()
  const defaultShares = suggestedEntry > 0 ? Math.max(1, Math.floor(1000 / suggestedEntry)) : 1
  const [shares, setShares] = useState(defaultShares)
  const [orderType, setOrderType] = useState('limit')  // 'limit' | 'market'
  const currentPrice = stockData.quote?.c ?? suggestedEntry
  const execPrice = orderType === 'limit' ? suggestedEntry : currentPrice

  const cost      = parseFloat((shares * execPrice).toFixed(2))
  const canAfford = cost <= portfolio.cash
  const riskPerSh = stopLoss ? parseFloat((suggestedEntry - stopLoss).toFixed(2)) : null
  const rewardPerSh = target2 ? parseFloat((target2 - suggestedEntry).toFixed(2)) : null

  function adjust(delta) {
    setShares(prev => Math.max(1, prev + delta))
  }

  function handleBuy() {
    const result = orderType === 'limit'
      ? setLimitBuy(symbol, suggestedEntry, shares, fib, mode)
      : buyPosition(symbol, currentPrice, shares, fib, mode)
    if (result.ok) {
      onBought?.()
      onClose()
    }
  }

  const modeLabel = { gap_down: 'Gap Down', earnings_down: 'Earnings Drop', gap_up: 'Gap Up' }[mode] || mode
  const entryLabel = isUp ? 'Fib 0.618 — gap-hold zone' : 'Fib 0.236 — first green candle'

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Sheet */}
      <div
        className="w-full rounded-t-2xl overflow-hidden"
        style={{ background: '#0f0f1a', border: '1px solid rgba(79,110,247,0.2)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#334155' }} />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xl font-bold" style={{ color: '#f0f2ff' }}>{symbol}</div>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(79,110,247,0.15)', color: '#818cf8', border: '1px solid rgba(79,110,247,0.3)' }}>
                {modeLabel}
              </span>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl" style={{ background: '#1a1a2e', color: '#64748b' }}>
              ✕
            </button>
          </div>

          {/* Entry / Stop / Targets grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <InfoCell
              label="Entry"
              sublabel={entryLabel}
              value={`$${suggestedEntry.toFixed(2)}`}
              color="#4f6ef7"
            />
            {stopLoss && (
              <InfoCell
                label="Stop Loss"
                sublabel={riskPerSh ? `-$${riskPerSh}/sh` : 'hard stop'}
                value={`$${stopLoss.toFixed(2)}`}
                color="#ef4444"
              />
            )}
            {target1 && (
              <InfoCell
                label="Target 1"
                sublabel={isUp ? 'Ext 1.272' : 'Fib 0.382'}
                value={`$${target1.toFixed(2)}`}
                color="#10b981"
              />
            )}
            {target2 && (
              <InfoCell
                label="Target 2"
                sublabel={isUp ? 'Ext 1.618' : 'Fib 0.618'}
                value={`$${target2.toFixed(2)}`}
                color="#10b981"
              />
            )}
          </div>

          {/* Order type toggle */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'limit', label: '⏳ Limit at Entry', sub: `Fill when price reaches $${suggestedEntry.toFixed(2)}` },
              { id: 'market', label: '⚡ Buy Now', sub: `Execute at $${currentPrice.toFixed(2)}` },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setOrderType(opt.id)}
                className="flex-1 px-3 py-2.5 rounded-xl text-left"
                style={{
                  background: orderType === opt.id ? 'rgba(79,110,247,0.15)' : '#1a1a2e',
                  border: `1px solid ${orderType === opt.id ? 'rgba(79,110,247,0.4)' : 'rgba(79,110,247,0.1)'}`,
                  boxShadow: orderType === opt.id ? '0 0 10px rgba(79,110,247,0.15)' : 'none',
                }}
              >
                <div className="text-xs font-bold" style={{ color: orderType === opt.id ? '#818cf8' : '#64748b' }}>{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{opt.sub}</div>
              </button>
            ))}
          </div>

          {orderType === 'limit' && (
            <div className="text-xs px-3 py-2 rounded-xl mb-4"
              style={{ background: 'rgba(79,110,247,0.07)', border: '1px solid rgba(79,110,247,0.15)', color: '#818cf8' }}>
              🎯 Order will execute automatically when the price reaches the Fib entry zone. You'll get a push notification.
            </div>
          )}

          {/* R/R badge */}
          {rr && (
            <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl"
              style={{ background: rr >= 2 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${rr >= 2 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <span className="text-sm font-semibold" style={{ color: rr >= 2 ? '#10b981' : '#ef4444' }}>
                R/R 1:{rr.toFixed(1)}
              </span>
              <span className="text-xs" style={{ color: '#64748b' }}>
                {rr >= 2 ? '✓ Viable setup' : '✕ Below 2:1 threshold — caution'}
              </span>
            </div>
          )}

          {/* Shares stepper */}
          <div className="mb-2">
            <div className="text-xs font-semibold mb-2" style={{ color: '#64748b', letterSpacing: '0.06em' }}>SHARES</div>
            <div className="flex items-center gap-3">
              <button onClick={() => adjust(-10)} className="w-10 h-10 rounded-xl text-lg font-bold flex items-center justify-center"
                style={{ background: '#1a1a2e', color: '#818cf8' }}>−</button>
              <button onClick={() => adjust(-1)} className="w-10 h-10 rounded-xl text-lg font-bold flex items-center justify-center"
                style={{ background: '#1a1a2e', color: '#818cf8' }}>−</button>
              <input
                type="number"
                value={shares}
                min={1}
                onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center text-xl font-bold rounded-xl py-2.5 border outline-none"
                style={{ background: '#1a1a2e', color: '#f0f2ff', borderColor: 'rgba(79,110,247,0.3)' }}
              />
              <button onClick={() => adjust(1)} className="w-10 h-10 rounded-xl text-lg font-bold flex items-center justify-center"
                style={{ background: '#1a1a2e', color: '#818cf8' }}>+</button>
              <button onClick={() => adjust(10)} className="w-10 h-10 rounded-xl text-lg font-bold flex items-center justify-center"
                style={{ background: '#1a1a2e', color: '#818cf8' }}>+</button>
            </div>
          </div>

          {/* Cost + cash summary */}
          <div className="flex justify-between text-sm mb-5 px-1">
            <span style={{ color: '#64748b' }}>
              Cost: <span className="font-bold" style={{ color: canAfford ? '#f0f2ff' : '#ef4444' }}>${cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </span>
            <span style={{ color: '#64748b' }}>
              Cash after: <span className="font-bold" style={{ color: canAfford ? '#10b981' : '#ef4444' }}>
                ${(portfolio.cash - cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>

          {!canAfford && (
            <div className="text-center text-sm mb-3 py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              Insufficient cash — reduce shares
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={!canAfford}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-40"
            style={{
              background: canAfford ? 'linear-gradient(135deg, #4f6ef7 0%, #7c3aed 100%)' : '#1a1a2e',
              color: '#fff',
              boxShadow: canAfford ? '0 0 24px rgba(79,110,247,0.35)' : 'none',
            }}
          >
            {orderType === 'limit'
            ? `Set Limit — ${shares} shares at $${suggestedEntry.toFixed(2)}`
            : `Buy Now — ${shares} shares at $${currentPrice.toFixed(2)}`}
          </button>

          <p className="text-center text-xs mt-3" style={{ color: '#475569' }}>
            This is a demo trade — no real money involved
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, sublabel, value, color }) {
  return (
    <div className="px-3 py-3 rounded-xl" style={{ background: '#1a1a2e', border: '1px solid rgba(79,110,247,0.1)' }}>
      <div className="text-xs mb-1" style={{ color: '#64748b' }}>{label}</div>
      <div className="text-base font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color: '#475569' }}>{sublabel}</div>
    </div>
  )
}

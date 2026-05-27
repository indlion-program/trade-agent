export function TradePlan({ fib }) {
  if (!fib || !fib.entryPrice) return null

  const rows = [
    { label: 'Entry Zone', sub: 'Fib 0.382 — after first green candle', value: `$${fib.entryPrice.toFixed(2)}`, color: '#22c55e' },
    { label: 'Stop Loss', sub: 'Pre-market low − 1.5% — hard stop', value: `$${fib.stopLoss.toFixed(2)}`, color: '#ef4444' },
    { label: 'Target 1', sub: 'Fib 0.618 — partial exit (50%)', value: fib.target2 ? `$${fib.target2.toFixed(2)}` : '—', color: '#22c55e' },
    { label: 'Target 2', sub: 'Fib 0.786 — trailing remainder', value: fib.target3 ? `$${fib.target3.toFixed(2)}` : '—', color: '#22c55e' },
  ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2a2a2a', background: '#1a1a1a' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#2a2a2a', background: '#222' }}>
        <span className="text-sm font-bold" style={{ color: '#f1f5f9', letterSpacing: '0.06em' }}>
          TRADE PLAN
        </span>
        {fib.riskReward !== null && (
          <span
            className="text-sm font-bold"
            style={{ color: fib.rrValid ? '#22c55e' : '#ef4444' }}
          >
            R/R 1:{fib.riskReward.toFixed(1)}
          </span>
        )}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-3 border-b last:border-0"
          style={{ borderColor: '#2a2a2a' }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{row.label}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{row.sub}</div>
          </div>
          <span className="text-xl font-bold font-mono tabular-nums" style={{ color: row.color }}>
            {row.value}
          </span>
        </div>
      ))}

      {/* Entry timing reminder */}
      <div className="px-4 py-3 border-t" style={{ borderColor: '#2a2a2a', background: 'rgba(245,158,11,0.05)' }}>
        <div className="flex items-start gap-2">
          <span style={{ color: '#f59e0b', fontSize: '16px' }}>⏱</span>
          <div className="text-sm" style={{ color: '#f59e0b' }}>
            <span className="font-semibold">Wait for first green 1-min candle</span>
            <span style={{ color: '#94a3b8' }}> after 9:30 AM ET. Do NOT enter at exactly 9:30:00.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

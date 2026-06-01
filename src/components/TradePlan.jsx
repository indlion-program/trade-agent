export function TradePlan({ fib, mode = 'gap_down' }) {
  if (!fib || !fib.entryPrice) return null

  const isUp = mode === 'gap_up'

  const rows = isUp ? [
    { label: 'Entry Zone',  sub: 'Fib 0.618 — pullback to gap-hold zone', value: fib.entryPrice ? `$${fib.entryPrice.toFixed(2)}` : '—', color: '#22c55e' },
    { label: 'Stop Loss',   sub: 'Below Fib 0.382 — gap failing',          value: fib.stopLoss   ? `$${fib.stopLoss.toFixed(2)}`   : '—', color: '#ef4444' },
    { label: 'Target 1',   sub: 'Ext 1.272 — partial exit (50%)',          value: fib.target1    ? `$${fib.target1.toFixed(2)}`    : '—', color: '#22c55e' },
    { label: 'Target 2',   sub: 'Ext 1.618 — trailing remainder',          value: fib.target2    ? `$${fib.target2.toFixed(2)}`    : '—', color: '#22c55e' },
  ] : [
    { label: 'Entry Zone',  sub: 'Fib 0.236 — first green candle above PM Low', value: fib.entryPrice ? `$${fib.entryPrice.toFixed(2)}` : '—', color: '#22c55e' },
    { label: 'Stop Loss',   sub: 'PM Low − 1% — hard stop',                      value: fib.stopLoss   ? `$${fib.stopLoss.toFixed(2)}`   : '—', color: '#ef4444' },
    { label: 'Target 1',   sub: 'Fib 0.382 — partial exit (50%)',                value: fib.target1    ? `$${fib.target1.toFixed(2)}`    : '—', color: '#22c55e' },
    { label: 'Target 2',   sub: 'Fib 0.618 — main target',                       value: fib.target2    ? `$${fib.target2.toFixed(2)}`    : '—', color: '#22c55e' },
  ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2a2a2a', background: '#1a1a1a' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#2a2a2a', background: '#222' }}>
        <span className="text-sm font-bold" style={{ color: '#f1f5f9', letterSpacing: '0.06em' }}>
          TRADE PLAN
        </span>
        {fib.riskReward !== null && (
          <span className="text-sm font-bold" style={{ color: fib.rrValid ? '#22c55e' : '#ef4444' }}>
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

export function FibTable({ fib, currentPrice }) {
  if (!fib) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: '#64748b' }}>
        Pre-market candle data unavailable.<br/>
        Fibonacci levels require 4:00–9:30 AM ET data.
      </div>
    )
  }

  const { levels, stopLoss, riskReward, rrValid } = fib

  return (
    <div>
      {/* Levels table */}
      <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#2a2a2a' }}>
        <div
          className="grid text-xs font-semibold px-3 py-2"
          style={{ gridTemplateColumns: '1fr 2fr 1.5fr', background: '#222', color: '#64748b', letterSpacing: '0.06em' }}
        >
          <span>LEVEL</span>
          <span>LABEL</span>
          <span className="text-right">PRICE</span>
        </div>
        {levels.map((level) => {
          const isEntry = level.role === 'entry'
          const isTarget2 = level.role === 'target2'
          const isStop = level.role === 'stop'
          const isNear = currentPrice && Math.abs(currentPrice - level.price) / level.price < 0.005

          let rowBg = 'transparent'
          let priceColor = '#94a3b8'
          if (isEntry) { rowBg = 'rgba(34,197,94,0.07)'; priceColor = '#22c55e' }
          if (isTarget2) { rowBg = 'rgba(34,197,94,0.05)'; priceColor = '#22c55e' }
          if (isStop) { rowBg = 'rgba(239,68,68,0.07)'; priceColor = '#ef4444' }
          if (isNear) rowBg = 'rgba(245,158,11,0.07)'

          return (
            <div
              key={level.ratio}
              className="grid items-center px-3 py-2.5 border-t text-sm"
              style={{ gridTemplateColumns: '1fr 2fr 1.5fr', borderColor: '#2a2a2a', background: rowBg }}
            >
              <span className="font-mono tabular-nums" style={{ color: '#64748b' }}>
                {level.ratio.toFixed(3)}
              </span>
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#f1f5f9' }}>{level.label}</span>
                {isEntry && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px' }}>
                    ENTRY
                  </span>
                )}
                {isTarget2 && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '10px' }}>
                    TARGET
                  </span>
                )}
                {isStop && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '10px' }}>
                    LOW
                  </span>
                )}
              </div>
              <span className="text-right font-mono font-semibold tabular-nums" style={{ color: priceColor }}>
                ${level.price.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Stop loss */}
      <div className="mt-2 px-3 py-2.5 rounded-lg border flex items-center justify-between"
        style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.25)' }}>
        <div>
          <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>Stop Loss</span>
          <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>Pre-market low − 1.5%</div>
        </div>
        <span className="text-lg font-bold font-mono tabular-nums" style={{ color: '#ef4444' }}>
          ${stopLoss.toFixed(2)}
        </span>
      </div>

      {/* R/R ratio */}
      {riskReward !== null && (
        <div
          className="mt-2 px-3 py-2.5 rounded-lg border flex items-center justify-between"
          style={{
            background: rrValid ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
            borderColor: rrValid ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
          }}
        >
          <div>
            <span className="text-sm font-semibold" style={{ color: rrValid ? '#22c55e' : '#ef4444' }}>
              Risk / Reward
            </span>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Entry 0.382 → Target 0.618 {rrValid ? '✓ viable' : '✕ below 2:1 threshold'}
            </div>
          </div>
          <span className="text-lg font-bold font-mono tabular-nums"
            style={{ color: rrValid ? '#22c55e' : '#ef4444' }}>
            1:{riskReward.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  )
}

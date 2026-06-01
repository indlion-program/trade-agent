export function FibTable({ fib, currentPrice, mode = 'gap_down' }) {
  if (!fib) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: '#64748b' }}>
        Fibonacci data unavailable — missing pre-market range.
      </div>
    )
  }

  const { levels, stopLoss, riskReward, rrValid } = fib
  const isUp = mode === 'gap_up'

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
          const isEntry    = level.role === 'entry'
          const isTarget   = level.role === 'target2' || level.role === 'ext_target2'
          const isStop     = level.role === 'stop'
          const isBreakout = level.role === 'breakout'
          const isExt      = level.isExtension
          const isNear     = currentPrice && Math.abs(currentPrice - level.price) / level.price < 0.005

          let rowBg    = 'transparent'
          let priceColor = isExt ? '#a78bfa' : '#94a3b8'
          if (isEntry)    { rowBg = 'rgba(34,197,94,0.07)';  priceColor = '#22c55e' }
          if (isTarget)   { rowBg = 'rgba(34,197,94,0.05)';  priceColor = '#22c55e' }
          if (isStop)     { rowBg = 'rgba(239,68,68,0.07)';  priceColor = '#ef4444' }
          if (isBreakout) { rowBg = 'rgba(34,197,94,0.04)';  priceColor = '#22c55e' }
          if (isExt)      { rowBg = 'rgba(167,139,250,0.06)' }
          if (isNear)     { rowBg = 'rgba(245,158,11,0.07)' }

          return (
            <div
              key={level.ratio}
              className="grid items-center px-3 py-2.5 border-t text-sm"
              style={{ gridTemplateColumns: '1fr 2fr 1.5fr', borderColor: '#2a2a2a', background: rowBg }}
            >
              <span className="font-mono tabular-nums" style={{ color: isExt ? '#7c3aed' : '#64748b', fontSize: isExt ? '10px' : undefined }}>
                {level.ratio.toFixed(3)}
              </span>
              <div className="flex items-center gap-1.5">
                <span style={{ color: isExt ? '#c4b5fd' : '#f1f5f9' }}>{level.label}</span>
                {isEntry && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px' }}>
                    ENTRY
                  </span>
                )}
                {isTarget && !isExt && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '10px' }}>
                    TARGET
                  </span>
                )}
                {isExt && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: '10px' }}>
                    EXT
                  </span>
                )}
                {isStop && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '10px' }}>
                    {isUp ? 'STOP' : 'LOW'}
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
          <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{isUp ? 'Fib 0.382 level' : 'PM Low − 1%'}</div>
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
              {isUp ? 'Entry 0.618 → Ext 1.618' : 'Entry 0.236 → Gap fill'} {rrValid ? '✓ viable' : '✕ below 2:1 threshold'}
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

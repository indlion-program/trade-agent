import { useState, useEffect } from 'react'

export function ScanProgress({ state, onCancel }) {
  const [queued, setQueued] = useState(0)
  useEffect(() => {
    const h = (e) => setQueued(e.detail?.queued ?? 0)
    window.addEventListener('apiCountUpdate', h)
    return () => window.removeEventListener('apiCountUpdate', h)
  }, [])

  const { phase, total, pass1Done, pass1Errors, candidates, pass2Done, startedAt, tvMode } = state
  if (phase === 'idle') return null

  const isActive = phase === 'tv_scan' || phase === 'pass1' || phase === 'pass2'

  const pass1Pct = total > 0 ? Math.round((pass1Done / total) * 100) : (phase === 'tv_scan' ? 0 : 100)
  const pass2Total = candidates.length
  const pass2Pct = pass2Total > 0 ? Math.round((pass2Done / pass2Total) * 100) : 0

  const elapsed = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0
  const elapsedMin = Math.floor(elapsed / 60)
  const elapsedSec = elapsed % 60

  const remaining = total - pass1Done
  const rateCallsPerSec = pass1Done > 0 && elapsed > 0 ? pass1Done / elapsed : 0
  const etaSec = rateCallsPerSec > 0 ? Math.round(remaining / rateCallsPerSec) : null
  const etaMin = etaSec !== null ? Math.floor(etaSec / 60) : null

  const phaseLabel =
    phase === 'tv_scan'
      ? '⚡ Instant scan via TradingView...'
      : phase === 'pass1'
      ? 'Pass 1 — pre-screening quotes'
      : phase === 'pass2'
      ? 'Pass 2 — full filter analysis'
      : phase === 'done'
      ? tvMode ? `⚡ Instant scan complete` : 'Scan complete'
      : phase === 'cancelled'
      ? 'Scan cancelled'
      : phase

  return (
    <div
      className="rounded-xl border p-4 mb-4"
      style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isActive && (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2" />
              <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <span className="text-sm font-bold" style={{ color: '#f1f5f9', letterSpacing: '0.04em' }}>
            {phaseLabel}
          </span>
        </div>
        {isActive && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs font-semibold px-2.5 py-1 rounded"
            style={{ background: '#222', color: '#ef4444', border: '1px solid #2a2a2a' }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Rate limit waiting banner */}
      {isActive && queued > 0 && (
        <div
          className="text-xs px-2.5 py-1.5 rounded mt-2"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          ⏳ API rate limit — {queued} call{queued !== 1 ? 's' : ''} waiting, resuming shortly...
        </div>
      )}

      {/* Pass 1 progress bar — hidden during tv_scan (instant) */}
      {phase !== 'tv_scan' && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: '#94a3b8' }}>
              {tvMode ? 'TV Screener' : 'Pre-screen'}: {pass1Done.toLocaleString()} / {total.toLocaleString()}
            </span>
            <span className="font-mono tabular-nums" style={{ color: '#64748b' }}>
              {pass1Pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0f0f0f' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${pass1Pct}%`,
                background: phase === 'pass1' ? '#22c55e' : phase === 'cancelled' ? '#ef4444' : '#16a34a',
              }}
            />
          </div>
        </div>
      )}

      {/* TV scan instant bar */}
      {phase === 'tv_scan' && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0f0f0f' }}>
            <div
              className="h-full"
              style={{
                width: '60%',
                background: 'linear-gradient(90deg, #22c55e40 0%, #22c55e 50%, #22c55e40 100%)',
                animation: 'shimmer 1.2s infinite',
              }}
            />
          </div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>
            Scanning all US stocks simultaneously...
          </div>
        </div>
      )}

      {/* Pass 2 progress */}
      {(phase === 'pass2' || (phase === 'done' && pass2Total > 0)) && (
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: '#94a3b8' }}>
              Full analysis: {pass2Done} / {pass2Total}
            </span>
            <span className="font-mono tabular-nums" style={{ color: '#64748b' }}>
              {pass2Pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0f0f0f' }}>
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${pass2Pct}%`, background: '#3b82f6' }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat
          label="Candidates"
          value={candidates.length.toString()}
          color={candidates.length > 0 ? '#22c55e' : '#64748b'}
        />
        <Stat
          label="Elapsed"
          value={`${elapsedMin}:${elapsedSec.toString().padStart(2, '0')}`}
          color="#94a3b8"
        />
        <Stat
          label={phase === 'pass1' ? 'ETA' : 'Errors'}
          value={phase === 'pass1' && etaMin !== null ? `~${etaMin}m` : pass1Errors.toString()}
          color={phase === 'pass1' ? '#94a3b8' : pass1Errors > 0 ? '#f59e0b' : '#94a3b8'}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: '#222' }}>
      <div className="text-xs" style={{ color: '#64748b', fontSize: '10px', letterSpacing: '0.06em' }}>
        {label.toUpperCase()}
      </div>
      <div className="text-sm font-bold font-mono tabular-nums mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

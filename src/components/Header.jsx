import { useState, useEffect } from 'react'
import { useMarketClock } from '../hooks/useMarketClock'
import { getEtTime } from '../utils/marketTime'

const STATUS_COLORS = {
  'PRE-MARKET': 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  'OPEN': 'text-green-400 bg-green-400/10 border-green-400/30',
  'AFTER-HOURS': 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  'CLOSED': 'text-slate-400 bg-slate-400/10 border-slate-400/30',
}

// Seconds until next market open (9:30 AM ET). Returns null if market is open.
function secsUntilOpen() {
  const now = new Date()
  const et = getEtTime(now)
  const h = et.getUTCHours()
  const m = et.getUTCMinutes()
  const s = et.getUTCSeconds()
  const day = et.getUTCDay()
  const totalSecs = h * 3600 + m * 60 + s
  const openSecs = 9 * 3600 + 30 * 60

  // Weekdays before 9:30 AM
  if (day >= 1 && day <= 5 && totalSecs < openSecs) {
    return openSecs - totalSecs
  }
  return null
}

function formatCountdown(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Header({ onBack, title, subtitle }) {
  const { time, date, status } = useMarketClock()
  const [apiCalls, setApiCalls] = useState(window.__apiCallsRemaining ?? 55)
  const [queued, setQueued] = useState(window.__apiQueueLength ?? 0)
  const [countdown, setCountdown] = useState(() => secsUntilOpen())

  useEffect(() => {
    function handle(e) {
      if (typeof e.detail === 'object') {
        setApiCalls(e.detail.remaining)
        setQueued(e.detail.queued)
      } else {
        setApiCalls(e.detail)
      }
    }
    window.addEventListener('apiCountUpdate', handle)
    return () => window.removeEventListener('apiCountUpdate', handle)
  }, [])

  // Countdown tick (updates every second via marketClock already, but we need secs)
  useEffect(() => {
    const t = setInterval(() => setCountdown(secsUntilOpen()), 1000)
    return () => clearInterval(t)
  }, [])

  const statusColor = STATUS_COLORS[status] || STATUS_COLORS['CLOSED']

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(15,15,15,0.97)',
        backdropFilter: 'blur(12px)',
        borderColor: '#2a2a2a',
      }}
    >
      <div className="px-4 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 min-h-[44px] px-1 -ml-1"
              style={{ color: '#22c55e' }}
              aria-label="Back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              <span className="text-sm font-medium">Scanner</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 32 32" className="shrink-0">
                <rect width="32" height="32" rx="6" fill="#1a1a1a"/>
                <polyline points="4,24 10,16 16,20 22,10 28,14" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-bold text-base" style={{ color: '#f1f5f9' }}>
                {title || 'Gap Scanner'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* API counter + queue depth */}
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ color: apiCalls < 10 ? '#ef4444' : '#64748b', background: '#1a1a1a' }}
              title={queued > 0 ? `${queued} call(s) queued` : ''}
            >
              {apiCalls}/55{queued > 0 ? ` ·${queued}` : ''}
            </span>

            {/* Market status badge */}
            <span
              className={`text-xs font-semibold px-2 py-1 rounded border ${statusColor}`}
              style={{ fontSize: '11px', letterSpacing: '0.05em' }}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Clock row */}
        <div className="flex items-center justify-between mt-1">
          {(onBack && subtitle) ? (
            <span className="text-sm truncate max-w-[200px]" style={{ color: '#64748b' }}>
              {subtitle}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#64748b' }}>{date}</span>
              {countdown !== null && (
                <span
                  className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  Open in {formatCountdown(countdown)}
                </span>
              )}
            </div>
          )}
          <span className="text-xs font-mono tabular-nums" style={{ color: '#64748b' }}>
            {time}
          </span>
        </div>
      </div>
    </header>
  )
}

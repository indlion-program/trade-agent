import { useState, useEffect } from 'react'
import { StatusBadge, NewsBadge } from './StatusBadge'
import { formatVol } from '../utils/filters'
import { isWatched, toggleWatch } from '../services/watchlist'

export function StockCard({ data, onClick }) {
  const { symbol, profile, quote, filterResult, newsClassified } = data

  const price = quote?.c ?? null
  const dp = quote?.dp ?? null
  const vol = quote?.v ?? null
  const companyName = profile?.name ?? data.name ?? symbol
  const status = filterResult?.status ?? 'AMBER'
  const rr = data.riskReward ?? null

  const [watched, setWatched] = useState(() => isWatched(symbol))

  useEffect(() => {
    function handle(e) {
      if (e.detail === symbol) setWatched(isWatched(symbol))
    }
    window.addEventListener('watchlistChange', handle)
    return () => window.removeEventListener('watchlistChange', handle)
  }, [symbol])

  const topNews = newsClassified?.find(n => n.classification !== 'NEUTRAL') ?? newsClassified?.[0]

  const borderLeft = {
    GREEN: '#22c55e',
    AMBER: '#f59e0b',
    RED: '#ef4444',
  }[status] || '#2a2a2a'

  const hardFails = filterResult?.hardFails ?? 0
  const filterPassCount = filterResult?.filters
    ? Object.values(filterResult.filters).filter(f => f.pass === true).length
    : null

  function handleWatchToggle(e) {
    e.stopPropagation()
    const nowWatched = toggleWatch(symbol)
    setWatched(nowWatched)
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border transition-colors active:opacity-80"
      style={{
        background: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderLeftColor: borderLeft,
        borderLeftWidth: '3px',
        minHeight: '44px',
      }}
      aria-label={`View ${symbol} details`}
    >
      <div className="p-4">
        {/* Top row: ticker + watch + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base" style={{ color: '#f1f5f9' }}>
                {symbol}
              </span>
              {filterResult?.newsAvoid && (
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>NEWS AVOID</span>
              )}
            </div>
            <div className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>
              {companyName}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Watchlist heart */}
            <button
              onClick={handleWatchToggle}
              className="p-1.5 rounded-lg"
              style={{ background: watched ? 'rgba(239,68,68,0.12)' : 'transparent', minHeight: '32px', minWidth: '32px' }}
              aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill={watched ? '#ef4444' : 'none'}>
                <path
                  d="M8 13.5s-6-3.8-6-7.5A3.5 3.5 0 018 3.28 3.5 3.5 0 0114 6c0 3.7-6 7.5-6 7.5z"
                  stroke={watched ? '#ef4444' : '#64748b'}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: '#f1f5f9' }}>
            {price !== null ? `$${price.toFixed(2)}` : '—'}
          </span>
          {dp !== null && (
            <span className="text-xl font-bold tabular-nums" style={{ color: dp <= 0 ? '#ef4444' : '#22c55e' }}>
              {dp > 0 ? '+' : ''}{dp.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {vol !== null && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#222', color: '#64748b' }}>
              VOL {formatVol(vol)}
            </span>
          )}
          {filterPassCount !== null && (
            <span
              className="text-xs px-2 py-0.5 rounded font-mono"
              style={{
                background: '#222',
                color: hardFails === 0 ? '#22c55e' : hardFails <= 2 ? '#f59e0b' : '#ef4444',
              }}
            >
              {filterPassCount}/10 filters
            </span>
          )}
          {rr !== null && rr >= 2.0 && (
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: '#222', color: '#22c55e' }}>
              R/R {rr}x
            </span>
          )}
        </div>

        {/* Top news */}
        {topNews && (
          <div className="flex items-start gap-2 pt-2 border-t" style={{ borderColor: '#2a2a2a' }}>
            <NewsBadge classification={topNews.classification} />
            <span className="text-xs leading-snug line-clamp-2" style={{ color: '#94a3b8' }}>
              {topNews.headline || topNews.summary}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

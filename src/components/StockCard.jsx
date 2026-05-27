import { StatusBadge, NewsBadge } from './StatusBadge'
import { formatVol } from '../utils/filters'

export function StockCard({ data, onClick }) {
  const { symbol, profile, quote, filterResult, newsClassified } = data

  const price = quote?.c ?? null
  const dp = quote?.dp ?? null
  const vol = quote?.v ?? null
  const companyName = profile?.name ?? symbol
  const status = filterResult?.status ?? 'AMBER'

  const topNews = newsClassified?.find(n => n.classification !== 'NEUTRAL') ?? newsClassified?.[0]

  // Card left border color by status
  const borderLeft = {
    GREEN: '#22c55e',
    AMBER: '#f59e0b',
    RED: '#ef4444',
  }[status] || '#2a2a2a'

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
        {/* Top row: ticker + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
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
          <StatusBadge status={status} size="sm" />
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <span
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: '#f1f5f9' }}
            >
              {price !== null ? `$${price.toFixed(2)}` : '—'}
            </span>
          </div>
          {dp !== null && (
            <span
              className="text-xl font-bold tabular-nums"
              style={{ color: dp <= 0 ? '#ef4444' : '#22c55e' }}
            >
              {dp > 0 ? '+' : ''}{dp.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Volume */}
        {vol !== null && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#222', color: '#64748b' }}>
              VOL {formatVol(vol)}
            </span>
          </div>
        )}

        {/* Top news */}
        {topNews && (
          <div className="flex items-start gap-2 pt-2 border-t" style={{ borderColor: '#2a2a2a' }}>
            <NewsBadge classification={topNews.classification} />
            <span className="text-xs leading-snug line-clamp-2" style={{ color: '#94a3b8' }}>
              {topNews.headline || topNews.summary}
            </span>
          </div>
        )}

        {/* Chevron indicator */}
        <div className="flex justify-end mt-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </button>
  )
}

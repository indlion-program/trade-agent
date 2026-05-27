import { NewsBadge } from './StatusBadge'

export function NewsFeed({ news }) {
  if (!news || news.length === 0) {
    return (
      <div className="py-6 text-center text-sm" style={{ color: '#64748b' }}>
        No news found for today.
      </div>
    )
  }

  // Sort: AVOID first, then OPPORTUNITY, then NEUTRAL
  const sorted = [...news].sort((a, b) => {
    const order = { AVOID: 0, OPPORTUNITY: 1, NEUTRAL: 2 }
    return (order[a.classification] ?? 2) - (order[b.classification] ?? 2)
  })

  return (
    <div className="space-y-2">
      {sorted.map((item, i) => {
        const ts = item.datetime
          ? new Date(item.datetime * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })
          : null

        return (
          <div
            key={i}
            className="rounded-lg p-3 border"
            style={{
              background: item.classification === 'AVOID'
                ? 'rgba(239,68,68,0.06)'
                : item.classification === 'OPPORTUNITY'
                  ? 'rgba(34,197,94,0.04)'
                  : '#1e1e1e',
              borderColor: item.classification === 'AVOID'
                ? 'rgba(239,68,68,0.2)'
                : item.classification === 'OPPORTUNITY'
                  ? 'rgba(34,197,94,0.15)'
                  : '#2a2a2a',
            }}
          >
            <div className="flex items-start gap-2 mb-1.5">
              <NewsBadge classification={item.classification} />
              {ts && (
                <span className="text-xs shrink-0 mt-px" style={{ color: '#64748b' }}>{ts} ET</span>
              )}
            </div>
            <p className="text-sm leading-snug" style={{ color: '#e2e8f0' }}>
              {item.headline || item.summary}
            </p>
            {item.source && (
              <span className="text-xs mt-1 block" style={{ color: '#64748b' }}>{item.source}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

import { FilterBadge } from './StatusBadge'

const FILTER_NAMES = [
  { key: 'preMarketDrop', label: 'Pre-market Drop', desc: '≤ -5.0%' },
  { key: 'price', label: 'Price', desc: '> $3.00' },
  { key: 'dailyVolume', label: 'Avg Daily Volume', desc: '≥ 750K' },
  { key: 'preMarketVolume', label: 'Pre-market Volume', desc: '≥ 50K' },
  { key: 'pe', label: 'P/E Ratio (TTM)', desc: '> 0 (profitable)' },
  { key: 'marketCap', label: 'Market Cap', desc: '≥ $500M' },
  { key: 'noReverseSplit', label: 'No Reverse Split', desc: 'Past 12 months' },
  { key: 'notEarningsDay', label: 'Not Earnings Day', desc: 'Skip earnings' },
  { key: 'entryTiming', label: 'Entry Timing', desc: 'Wait for green candle' },
  { key: 'americanBulls', label: 'AmericanBulls Signal', desc: 'Not SELL/STRONG SELL' },
]

export function FilterList({ filters }) {
  if (!filters) return null

  return (
    <div className="space-y-1">
      {FILTER_NAMES.map(({ key, label, desc }) => {
        const f = filters[key]
        if (!f) return null
        return (
          <div
            key={key}
            className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
            style={{ background: '#222' }}
          >
            <FilterBadge pass={f.pass} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: '#f1f5f9' }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{f.reason || desc}</div>
            </div>
            {f.value !== null && f.value !== undefined && (
              <div className="text-sm font-mono tabular-nums shrink-0" style={{ color: '#94a3b8' }}>
                {typeof f.value === 'number' && key === 'pe' ? f.value.toFixed(1) : ''}
                {typeof f.value === 'boolean' ? '' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

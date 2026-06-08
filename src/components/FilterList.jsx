import { FilterBadge } from './StatusBadge'

const FILTERS_GAP_DOWN = [
  { key: 'preMarketMove',   label: 'Gap / Drop',            desc: '≤ -3%' },
  { key: 'maxGap',          label: 'Not Climax Sell',       desc: 'Drop not extreme' },
  { key: 'price',           label: 'Price',                 desc: '≥ $5' },
  { key: 'pe',              label: 'P/E Ratio',             desc: '> 4 (profitable)' },
  { key: 'dailyVolume',     label: 'Avg Daily Volume',      desc: '≥ 700K' },
  { key: 'preMarketVolume', label: 'Pre-market Volume',     desc: 'Available' },
  { key: 'pmVolumeRatio',   label: 'PM Volume Ratio',       desc: '≥ 10% of avg daily vol' },
  { key: 'marketCap',       label: 'Market Cap',            desc: '≥ $200M' },
  { key: 'noReverseSplit',  label: 'No Reverse Split',      desc: 'Past 12 months' },
  { key: 'notEarningsDay',  label: 'Not Earnings Day',      desc: 'Skip earnings day' },
  { key: 'entryTiming',     label: 'Entry Timing',          desc: 'Wait for green candle' },
  { key: 'americanBulls',   label: 'AmericanBulls Signal',  desc: 'Not SELL/STRONG SELL' },
  { key: 'riskReward',      label: 'Risk / Reward',         desc: '≥ 2:1' },
]

const FILTERS_PM_GAP = [
  { key: 'preMarketMove',   label: 'Pre-market Drop',       desc: '≤ -5%' },
  { key: 'maxGap',          label: 'Not Climax Sell',       desc: '> -60%' },
  { key: 'price',           label: 'Price',                 desc: '≥ $5' },
  { key: 'pe',              label: 'P/E Ratio',             desc: '> 4 (profitable)' },
  { key: 'dailyVolume',     label: 'Avg Daily Volume',      desc: '≥ 700K' },
  { key: 'preMarketVolume', label: 'Pre-market Volume',     desc: '≥ 60K' },
  { key: 'pmVolumeRatio',   label: 'PM Volume Ratio',       desc: '≥ 10% of avg daily vol' },
  { key: 'marketCap',       label: 'Market Cap',            desc: '≥ $100M' },
  { key: 'noReverseSplit',  label: 'No Reverse Split',      desc: 'Past 12 months' },
  { key: 'notEarningsDay',  label: 'Not Earnings Day',      desc: 'Skip earnings day' },
  { key: 'entryTiming',     label: 'Entry Timing',          desc: 'Wait for green candle after 9:30' },
  { key: 'americanBulls',   label: 'AmericanBulls Signal',  desc: 'Not SELL/STRONG SELL' },
  { key: 'riskReward',      label: 'Risk / Reward',         desc: '≥ 2:1 (Fib 0.236 entry)' },
]

const FILTERS_EARNINGS = [
  { key: 'preMarketMove',   label: 'Pre-market Drop',       desc: '≤ -10%' },
  { key: 'maxGap',          label: 'Max Gap',               desc: '> -60% (extreme excluded)' },
  { key: 'price',           label: 'Price',                 desc: '≥ $10' },
  { key: 'pe',              label: 'P/E Ratio',             desc: 'N/A' },
  { key: 'dailyVolume',     label: 'Avg Daily Volume',      desc: '≥ 2M' },
  { key: 'preMarketVolume', label: 'Pre-market Volume',     desc: '≥ 200K' },
  { key: 'pmVolumeRatio',   label: 'PM Volume Ratio',       desc: '≥ 25% of avg daily vol' },
  { key: 'marketCap',       label: 'Market Cap',            desc: '≥ $2B' },
  { key: 'noReverseSplit',  label: 'No Reverse Split',      desc: 'Past 12 months' },
  { key: 'notEarningsDay',  label: 'Earnings Day',          desc: 'Earnings required today' },
  { key: 'entryTiming',     label: 'Entry Timing',          desc: 'Wait for green candle' },
  { key: 'americanBulls',   label: 'AmericanBulls Signal',  desc: 'Not SELL/STRONG SELL' },
  { key: 'riskReward',      label: 'Risk / Reward',         desc: '≥ 2:1 (Fib 0.236 entry)' },
]

const FILTERS_UP = [
  { key: 'preMarketMove',   label: 'Pre-market Gain',       desc: '≥ +7%' },
  { key: 'maxGap',          label: 'Max Gap',               desc: 'N/A' },
  { key: 'price',           label: 'Price',                 desc: '≥ $8' },
  { key: 'pe',              label: 'P/E Ratio',             desc: 'N/A' },
  { key: 'dailyVolume',     label: 'Avg Daily Volume',      desc: '≥ 1.5M' },
  { key: 'preMarketVolume', label: 'Pre-market Volume',     desc: '≥ 150K' },
  { key: 'pmVolumeRatio',   label: 'PM Volume Ratio',       desc: '≥ 20% of avg daily vol' },
  { key: 'marketCap',       label: 'Market Cap',            desc: '≥ $1B' },
  { key: 'noReverseSplit',  label: 'No Reverse Split',      desc: 'Past 12 months' },
  { key: 'notEarningsDay',  label: 'Not Earnings Day',      desc: 'Skip earnings' },
  { key: 'entryTiming',     label: 'Entry Timing',          desc: 'Wait for green candle' },
  { key: 'americanBulls',   label: 'AmericanBulls Signal',  desc: 'Not SELL/STRONG SELL' },
  { key: 'riskReward',      label: 'Risk / Reward',         desc: '≥ 2:1 (Fib 0.618 entry)' },
]

const FILTER_MAP = {
  gap_down:       FILTERS_GAP_DOWN,
  pre_market_gap: FILTERS_PM_GAP,
  earnings_down:  FILTERS_EARNINGS,
  gap_up:         FILTERS_UP,
}

export function FilterList({ filters, mode = 'gap_down' }) {
  if (!filters) return null
  const rows = FILTER_MAP[mode] ?? FILTERS_GAP_DOWN

  return (
    <div className="space-y-1">
      {rows.map(({ key, label, desc }) => {
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
          </div>
        )
      })}
    </div>
  )
}

import { useState } from 'react'
import { UNIVERSE_GROUPS } from '../data/universe'
import { expandToFullUsUniverse } from '../services/scanner'

const PRESETS = [
  { id: 'starter', label: 'Watchlist', desc: '20 mega-caps — instant' },
  { id: 'curated', label: 'Curated', desc: `${UNIVERSE_GROUPS.curated.length} liquid stocks + ETFs` },
  { id: 'largecaps', label: 'Large Caps', desc: `${UNIVERSE_GROUPS.largecaps.length} S&P 500 core` },
  { id: 'etfs', label: 'ETFs Only', desc: `${UNIVERSE_GROUPS.etfs.length} liquid ETFs` },
  { id: 'tech', label: 'Tech', desc: `${UNIVERSE_GROUPS.tech.length} tech & growth` },
  { id: 'speculative', label: 'Speculative', desc: `${UNIVERSE_GROUPS.speculative.length} EV / meme / crypto` },
]

export function UniverseSelector({ value, fullUniverse, onChange, onExpandUniverse }) {
  const [expanding, setExpanding] = useState(false)
  const [open, setOpen] = useState(false)

  const handleExpand = async () => {
    setExpanding(true)
    try {
      const symbols = await expandToFullUsUniverse()
      onExpandUniverse(symbols)
    } catch (e) {
      alert('Failed to fetch full US universe: ' + e.message)
    } finally {
      setExpanding(false)
    }
  }

  const currentLabel =
    value === 'full' && fullUniverse
      ? `Full US (${fullUniverse.length.toLocaleString()})`
      : PRESETS.find((p) => p.id === value)?.label || 'Custom'
  const currentCount =
    value === 'full' && fullUniverse
      ? fullUniverse.length
      : UNIVERSE_GROUPS[value]?.length || 0

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-3 border"
        style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
      >
        <div className="text-left">
          <div className="text-xs" style={{ color: '#64748b', letterSpacing: '0.06em' }}>
            UNIVERSE
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: '#f1f5f9' }}>
            {currentLabel} <span style={{ color: '#64748b', fontWeight: 'normal' }}>· {currentCount.toLocaleString()} symbols</span>
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <path d="M4 6l4 4 4-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border overflow-hidden" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.id)
                setOpen(false)
              }}
              className="w-full flex items-center justify-between px-4 py-3 border-b text-left"
              style={{
                borderColor: '#2a2a2a',
                background: value === p.id ? 'rgba(34,197,94,0.06)' : 'transparent',
              }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: value === p.id ? '#22c55e' : '#f1f5f9' }}>
                  {p.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                  {p.desc}
                </div>
              </div>
              {value === p.id && (
                <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
              )}
            </button>
          ))}

          {/* Full US universe */}
          <button
            onClick={() => {
              if (fullUniverse) {
                onChange('full')
                setOpen(false)
              } else {
                handleExpand()
              }
            }}
            disabled={expanding}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            style={{
              background: value === 'full' ? 'rgba(34,197,94,0.06)' : 'transparent',
              opacity: expanding ? 0.6 : 1,
            }}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: value === 'full' ? '#22c55e' : '#f1f5f9' }}>
                {fullUniverse ? `Full US Universe (${fullUniverse.length.toLocaleString()})` : 'Expand: Full US Universe'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                {fullUniverse
                  ? 'Cached — instant rescan'
                  : expanding
                  ? 'Fetching from Finnhub...'
                  : '1 API call → ~5,000 symbols, cached 7 days'}
              </div>
            </div>
            {expanding ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2" />
                <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : value === 'full' ? (
              <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
            ) : null}
          </button>
        </div>
      )}
    </div>
  )
}

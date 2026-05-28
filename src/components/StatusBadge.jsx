export function StatusBadge({ status, size = 'md' }) {
  const configs = {
    GREEN: {
      label: 'ALL PASS',
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.35)',
      color: '#22c55e',
    },
    AMBER: {
      label: 'WARNINGS',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.35)',
      color: '#f59e0b',
    },
    RED: {
      label: 'AVOID',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.35)',
      color: '#ef4444',
    },
  }

  const cfg = configs[status] || configs.AMBER
  const textSize = size === 'sm' ? '10px' : '11px'
  const px = size === 'sm' ? '6px' : '8px'
  const py = size === 'sm' ? '2px' : '4px'

  return (
    <span
      className="inline-flex items-center font-bold rounded border"
      style={{
        fontSize: textSize,
        letterSpacing: '0.08em',
        padding: `${py} ${px}`,
        background: cfg.bg,
        borderColor: cfg.border,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  )
}

export function FilterBadge({ pass }) {
  if (pass === true) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0"
        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
        ✓
      </span>
    )
  }
  if (pass === false) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
        ✕
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0"
      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
      ?
    </span>
  )
}

export function NewsBadge({ classification }) {
  const configs = {
    AVOID: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
    OPPORTUNITY: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
    NEUTRAL: { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  }
  const cfg = configs[classification] || configs.NEUTRAL
  return (
    <span
      className="inline-flex items-center rounded border font-semibold shrink-0"
      style={{
        fontSize: '10px',
        letterSpacing: '0.06em',
        padding: '2px 5px',
        color: cfg.color,
        background: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      {classification}
    </span>
  )
}

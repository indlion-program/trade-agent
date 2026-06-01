import { useState, useEffect } from 'react'
import { usePaperPortfolio } from '../hooks/usePaperPortfolio'
import { usePriceMonitor } from '../hooks/usePriceMonitor'
import { sellAll, setNotifyTopic, resetPortfolio } from '../services/paper'
import { sendTestAlert, requestBrowserPermission, getBrowserPermission } from '../services/notify'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPnl(n) {
  if (n == null) return null
  return (n >= 0 ? '+' : '') + fmt(n)
}

function pnlColor(n) {
  if (n > 0) return '#10b981'
  if (n < 0) return '#ef4444'
  return '#64748b'
}

function progressPct(current, stop, target) {
  if (!stop || !target || target === stop) return 50
  const pct = ((current - stop) / (target - stop)) * 100
  return Math.max(2, Math.min(98, pct))
}

function timeSince(ms) {
  if (!ms) return ''
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function PortfolioScreen() {
  const livePrices = usePriceMonitor()
  const { portfolio, equity } = usePaperPortfolio(livePrices)
  const [showSettings, setShowSettings] = useState(false)
  const [topicInput, setTopicInput] = useState(portfolio.notifyTopic || '')
  const [testSending, setTestSending] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [browserPerm, setBrowserPerm] = useState(() => getBrowserPermission())

  useEffect(() => {
    setTopicInput(portfolio.notifyTopic || '')
  }, [portfolio.notifyTopic])

  const pnlPct = equity.deposited > 0
    ? ((equity.pnl / equity.deposited) * 100).toFixed(2)
    : '0.00'

  const history = portfolio.history || []
  const wins  = history.filter(h => !h.partial && h.pnl > 0).length
  const losses= history.filter(h => !h.partial && h.pnl <= 0).length
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080810' }}>
      {/* ── Portfolio Summary ───────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #141428 100%)', border: '1px solid rgba(79,110,247,0.2)' }}>
          {/* Glow orb */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(79,110,247,0.12) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />

          <div className="text-xs font-semibold mb-1" style={{ color: '#64748b', letterSpacing: '0.08em' }}>DEMO PORTFOLIO</div>
          <div className="text-4xl font-bold mb-1"
            style={{ color: '#f0f2ff', textShadow: '0 0 24px rgba(79,110,247,0.4)', fontFeatureSettings: '"tnum"' }}>
            ${fmt(equity.total)}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <PnlPill value={equity.pnl} pct={pnlPct} />
            {winRate !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                {winRate}% win rate
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EquityCell label="Cash Available" value={`$${fmt(equity.cash)}`} color="#4f6ef7" />
            <EquityCell label="Invested" value={`$${fmt(equity.invested)}`} color="#7c3aed" />
          </div>
        </div>
      </div>

      {/* ── Open Positions ──────────────────────────────────────────────────── */}
      <Section title="Open Positions" count={portfolio.positions?.length || 0}>
        {!portfolio.positions?.length ? (
          <EmptyState icon="📈" text="No open positions" sub='Hit "Buy Demo" on any scanned stock' />
        ) : (
          <div className="space-y-3">
            {portfolio.positions.map(pos => (
              <PositionCard key={pos.id} pos={pos} livePrice={livePrices[pos.symbol]} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Trade History ───────────────────────────────────────────────────── */}
      <Section title="Trade History" count={history.filter(h => !h.partial).length}>
        {!history.filter(h => !h.partial).length ? (
          <EmptyState icon="📋" text="No closed trades yet" sub="Your completed trades will appear here" />
        ) : (
          <div className="space-y-2">
            {history.filter(h => !h.partial).map(trade => (
              <TradeHistoryRow key={trade.id} trade={trade} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Settings ────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-2">
        <button
          onClick={() => setShowSettings(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: '#0f0f1a', border: '1px solid rgba(79,110,247,0.15)', color: '#94a3b8' }}
        >
          <span className="text-sm font-semibold">⚙ Settings & Notifications</span>
          <span style={{ transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
        </button>

        {showSettings && (
          <div className="mt-2 px-4 py-4 rounded-xl space-y-4"
            style={{ background: '#0f0f1a', border: '1px solid rgba(79,110,247,0.12)' }}>

            {/* ntfy.sh */}
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: '#64748b' }}>📱 PHONE PUSH NOTIFICATIONS (ntfy.sh)</div>
              <div className="text-xs mb-2" style={{ color: '#475569' }}>
                Free • Install <strong style={{ color: '#818cf8' }}>ntfy app</strong> → subscribe to your topic → get alerts on your phone
              </div>
              <div className="flex gap-2">
                <input
                  value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  onBlur={() => setNotifyTopic(topicInput)}
                  placeholder="e.g. trading-yourname123"
                  className="flex-1 px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ background: '#1a1a2e', borderColor: 'rgba(79,110,247,0.3)', color: '#f0f2ff' }}
                />
                <button
                  disabled={testSending || !topicInput.trim()}
                  onClick={async () => {
                    setTestSending(true)
                    await sendTestAlert(topicInput.trim())
                    setTestSending(false)
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(79,110,247,0.2)', color: '#818cf8', border: '1px solid rgba(79,110,247,0.3)' }}
                >
                  {testSending ? '...' : 'Test'}
                </button>
              </div>
            </div>

            {/* Browser notifications */}
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: '#64748b' }}>🔔 BROWSER NOTIFICATIONS</div>
              {browserPerm === 'granted' ? (
                <div className="text-xs" style={{ color: '#10b981' }}>✓ Enabled — desktop/Android Chrome notifications active</div>
              ) : browserPerm === 'denied' ? (
                <div className="text-xs" style={{ color: '#ef4444' }}>Blocked — enable in browser settings</div>
              ) : (
                <button
                  onClick={async () => {
                    const perm = await requestBrowserPermission()
                    setBrowserPerm(perm)
                  }}
                  className="text-xs px-3 py-2 rounded-xl font-semibold"
                  style={{ background: 'rgba(79,110,247,0.15)', color: '#818cf8', border: '1px solid rgba(79,110,247,0.3)' }}
                >
                  Enable browser notifications
                </button>
              )}
            </div>

            {/* Reset */}
            <div className="border-t pt-3" style={{ borderColor: 'rgba(239,68,68,0.1)' }}>
              {!showReset ? (
                <button
                  onClick={() => setShowReset(true)}
                  className="text-xs px-3 py-2 rounded-xl font-semibold"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  Reset to $20,000
                </button>
              ) : (
                <div>
                  <div className="text-xs mb-2" style={{ color: '#ef4444' }}>⚠ This will erase all positions and history. Are you sure?</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { resetPortfolio(); setShowReset(false) }}
                      className="px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ background: '#ef4444', color: '#fff' }}
                    >
                      Yes, reset
                    </button>
                    <button onClick={() => setShowReset(false)}
                      className="px-4 py-2 rounded-xl text-xs"
                      style={{ background: '#1a1a2e', color: '#94a3b8' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PnlPill({ value, pct }) {
  const pos = value >= 0
  return (
    <span className="px-3 py-1 rounded-full text-sm font-bold"
      style={{
        background: pos ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
        color: pos ? '#10b981' : '#ef4444',
        border: `1px solid ${pos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}>
      {fmtPnl(value)} ({pos ? '+' : ''}{pct}%)
    </span>
  )
}

function EquityCell({ label, value, color }) {
  return (
    <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-xs mb-0.5" style={{ color: '#64748b' }}>{label}</div>
      <div className="text-base font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <div className="px-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold" style={{ color: '#f0f2ff' }}>{title}</span>
        {count > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'rgba(79,110,247,0.15)', color: '#818cf8' }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon, text, sub }) {
  return (
    <div className="text-center py-8 rounded-2xl" style={{ background: '#0f0f1a', border: '1px solid rgba(79,110,247,0.08)' }}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm font-semibold mb-1" style={{ color: '#94a3b8' }}>{text}</div>
      <div className="text-xs" style={{ color: '#475569' }}>{sub}</div>
    </div>
  )
}

function PositionCard({ pos, livePrice }) {
  const price = livePrice ?? pos.entryPrice
  const pnl    = pos.sharesOpen > 0 ? (price - pos.entryPrice) * pos.sharesOpen : 0
  const pnlPct = pos.entryPrice > 0 ? ((price - pos.entryPrice) / pos.entryPrice * 100).toFixed(2) : '0.00'
  const isProfit = pnl >= 0
  const modeLabel = { gap_down: 'Gap↓', earnings_down: 'Earnings↓', gap_up: 'Gap↑' }[pos.mode] || pos.mode

  const progressPos = pos.stopLoss && pos.target2
    ? progressPct(price, pos.stopLoss, pos.target2)
    : 50

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: '#0f0f1a', border: '1px solid rgba(79,110,247,0.12)', borderLeft: `3px solid ${isProfit ? '#4f6ef7' : '#ef4444'}` }}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold" style={{ color: '#f0f2ff' }}>{pos.symbol}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(79,110,247,0.1)', color: '#818cf8' }}>{modeLabel}</span>
              {pos.hitTargets.includes('target1') && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>T1 ✓</span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {pos.sharesOpen} shares · entry ${fmt(pos.entryPrice)} · {timeSince(pos.openedAt)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-bold font-mono" style={{ color: '#f0f2ff' }}>${fmt(price)}</div>
            <div className="text-sm font-semibold" style={{ color: pnlColor(pnl) }}>
              {fmtPnl(pnl)} ({pnl >= 0 ? '+' : ''}{pnlPct}%)
            </div>
          </div>
        </div>

        {/* Stop ↔ Target progress bar */}
        {pos.stopLoss && pos.target2 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: '#475569' }}>
              <span style={{ color: '#ef4444' }}>Stop ${fmt(pos.stopLoss)}</span>
              <span style={{ color: '#10b981' }}>T2 ${fmt(pos.target2)}</span>
            </div>
            <div className="relative h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${progressPos}%`, background: isProfit ? 'linear-gradient(90deg, #4f6ef7, #10b981)' : 'linear-gradient(90deg, #ef4444, #f59e0b)' }} />
              <div className="absolute top-1/2 w-3 h-3 rounded-full -translate-y-1/2 -translate-x-1.5"
                style={{ left: `${progressPos}%`, background: isProfit ? '#4f6ef7' : '#ef4444', boxShadow: `0 0 6px ${isProfit ? '#4f6ef7' : '#ef4444'}` }} />
            </div>
          </div>
        )}

        <button
          onClick={() => sellAll(pos.id, price, 'manual')}
          className="w-full py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          Close at ${fmt(price)}
        </button>
      </div>
    </div>
  )
}

function TradeHistoryRow({ trade }) {
  const win = trade.pnl > 0
  const reasonLabel = { target1: 'T1 hit', target2: 'T2 hit', stop: 'Stop', manual: 'Manual' }[trade.closeReason] || trade.closeReason

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: '#0f0f1a', border: '1px solid rgba(79,110,247,0.08)' }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
        style={{ background: win ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: win ? '#10b981' : '#ef4444' }}>
        {win ? '✓' : '✕'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: '#f0f2ff' }}>{trade.symbol}</span>
          <span className="text-xs" style={{ color: '#475569' }}>{reasonLabel}</span>
        </div>
        <div className="text-xs" style={{ color: '#64748b' }}>
          ${fmt(trade.entryPrice)} → ${fmt(trade.exitPrice)} · {trade.shares} sh · {timeSince(trade.closedAt)}
        </div>
      </div>
      <div className="text-sm font-bold font-mono text-right" style={{ color: pnlColor(trade.pnl) }}>
        {fmtPnl(trade.pnl)}
      </div>
    </div>
  )
}

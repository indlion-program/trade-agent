import { useState, useEffect, useRef } from 'react'
import { Header } from '../components/Header'
import { StatusBadge } from '../components/StatusBadge'
import { FilterList } from '../components/FilterList'
import { FibTable } from '../components/FibTable'
import { TradePlan } from '../components/TradePlan'
import { NewsFeed } from '../components/NewsFeed'
import { LivePriceTicker } from '../components/LivePriceTicker'
import { SkeletonDetail } from '../components/SkeletonCard'
import { fetchLightAnalysis } from '../services/finnhub'
import { BuyModal } from '../components/BuyModal'
import { runAllFilters, filterAmericanBulls, computeScore } from '../utils/filters'
import { fetchAmericanBullsSignal } from '../services/americanbulls'
import { classifyNewsList } from '../utils/newsClassifier'
import { calculateFibLevels } from '../utils/fibonacci'
import { formatMarketCap, formatVol } from '../utils/filters'
import { isWatched, toggleWatch } from '../services/watchlist'
import { useLivePrice } from '../hooks/useLivePrice'
import { alertStopLoss, alertTakeProfit, alertAvoidNews } from '../services/notify'

export function DetailScreen({ stockData: initialData, onBack }) {
  const [data, setData] = useState(initialData)
  // fib is derived — no state needed
  const [abSignal, setAbSignal] = useState(null)
  const [abLoading, setAbLoading] = useState(true)
  const [abError, setAbError] = useState(null)
  const [activeTab, setActiveTab] = useState('plan')
  const [watched, setWatched] = useState(() => isWatched(initialData.symbol))
  const [copied, setCopied] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)

  const { symbol } = data
  const quote = data.quote
  const profile = data.profile
  const metrics = data.metrics
  const filterResult = data.filterResult
  const newsClassified = data.newsClassified || []

  const price = quote?.c ?? null
  const dp = quote?.dp ?? null
  const mc = profile?.marketCapitalization ? profile.marketCapitalization * 1_000_000 : null
  const pe = metrics?.metric?.peBasicExclExtraTTM ?? metrics?.metric?.peTTM ?? null
  const sector = profile?.finnhubIndustry ?? profile?.sector ?? data.sector ?? '—'
  const exchange = profile?.exchange ?? data.exchange ?? '—'
  const vol = quote?.v ?? null

  // Mode-aware Fibonacci
  const mode = data.mode || 'gap_down'
  const tv = data.tvData
  const isGapUp = mode === 'gap_up'
  const fib = (() => {
    if (isGapUp) {
      // gap_up: anchor low=prevClose, high=pmHigh; targets are extensions above pmHigh
      const hi = tv?.pmHigh ?? quote?.h ?? null
      const lo = tv?.prevClose ?? quote?.pc ?? null
      return hi && lo && hi > lo ? calculateFibLevels(hi, lo, { extensions: true, mode: 'gap_up' }) : null
    }
    // gap_down / earnings_down: anchor high=prevClose (gap origin), low=pmLow (gap bottom)
    const hi = tv?.prevClose ?? quote?.pc ?? null
    const lo = tv?.pmLow ?? quote?.l ?? null
    return hi && lo && hi > lo ? calculateFibLevels(hi, lo, { mode }) : null
  })()

  // Auto-fetch AmericanBulls signal
  useEffect(() => {
    let cancelled = false
    setAbLoading(true)
    setAbError(null)
    setAbSignal(null)
    fetchAmericanBullsSignal(symbol)
      .then(({ signal }) => {
        if (!cancelled) { setAbSignal(signal); setAbLoading(false) }
      })
      .catch(err => {
        if (!cancelled) { setAbError(err.message); setAbLoading(false) }
      })
    return () => { cancelled = true }
  }, [symbol])

  // Refresh news in background using Yahoo RSS — no Finnhub calls, tvData preserved
  useEffect(() => {
    const tv = initialData.tvData
    if (!tv) return
    fetchLightAnalysis(symbol, initialData.quote, tv, null).then(raw => {
      const filterResult = runAllFilters(raw, mode)
      const newsClassified = classifyNewsList(raw.news || [])
      setData(prev => ({ ...raw, filterResult, newsClassified, tvData: prev.tvData, mode: prev.mode }))
    }).catch(() => {})
  }, [symbol])

  // Keep watch state in sync
  useEffect(() => {
    function handle(e) {
      if (e.detail === symbol) setWatched(isWatched(symbol))
    }
    window.addEventListener('watchlistChange', handle)
    return () => window.removeEventListener('watchlistChange', handle)
  }, [symbol])

  // Live price for alert monitoring (separate from LivePriceTicker display)
  const { price: livePrice } = useLivePrice(symbol, price)
  const alertedLevels = useRef(new Set())

  // Stop loss and take profit alerts — fire once per level per session
  useEffect(() => {
    if (livePrice === null || !fib) return
    const al = alertedLevels.current
    if (!al.has('stop') && fib.stopLoss && livePrice <= fib.stopLoss) {
      al.add('stop')
      alertStopLoss(symbol, livePrice, fib.stopLoss).catch(() => {})
    }
    if (!al.has('t1') && fib.target1 && livePrice >= fib.target1) {
      al.add('t1')
      alertTakeProfit(symbol, livePrice, 'Target 1', fib.target1, true).catch(() => {})
    }
    if (!al.has('t2') && fib.target2 && livePrice >= fib.target2) {
      al.add('t2')
      alertTakeProfit(symbol, livePrice, 'Target 2', fib.target2, true).catch(() => {})
    }
    if (!al.has('t3') && fib.target3 && livePrice >= fib.target3) {
      al.add('t3')
      alertTakeProfit(symbol, livePrice, 'Target 3', fib.target3, false).catch(() => {})
    }
  }, [livePrice, fib, symbol])

  // Avoid news alert — fire once when AVOID headline detected
  const avoidNewsAlerted = useRef(false)
  useEffect(() => {
    if (!avoidNewsAlerted.current && newsClassified.some(n => n.classification === 'AVOID')) {
      avoidNewsAlerted.current = true
      const first = newsClassified.find(n => n.classification === 'AVOID')
      if (first) alertAvoidNews(symbol, first.headline).catch(() => {})
    }
  }, [newsClassified, symbol])

  const hasAvoidNews = newsClassified.some(n => n.classification === 'AVOID')
  const avoidNewsItems = newsClassified.filter(n => n.classification === 'AVOID')

  // Derive live F11 (AmericanBulls) and merge into filter list
  const liveF11 = filterAmericanBulls(abLoading ? null : true, abSignal)
  const liveFilters = filterResult
    ? { ...filterResult.filters, americanBulls: liveF11 }
    : null
  const liveHardFails = liveFilters
    ? Object.values(liveFilters).filter(f => f.pass === false).length
    : (filterResult?.hardFails ?? 0)
  const liveScore = liveFilters ? computeScore(liveFilters, quote, mode) : (filterResult?.score ?? 0)

  function abSignalColor(sig) {
    if (!sig) return '#64748b'
    if (sig === 'STRONG SELL') return '#ef4444'
    if (sig === 'SELL') return '#f59e0b'   // amber — caution, not hard stop
    if (sig === 'STRONG BUY' || sig === 'BUY' || sig === 'STAY LONG') return '#22c55e'
    return '#f59e0b'
  }

  const tabs = [
    { id: 'plan', label: 'Trade Plan' },
    { id: 'filters', label: `Filters (${liveHardFails} fail)` },
    { id: 'news', label: `News (${newsClassified.length})` },
  ]

  function handleWatchToggle() {
    const nowWatched = toggleWatch(symbol)
    setWatched(nowWatched)
  }

  function handleCopyPlan() {
    if (!fib) return
    const strategyLabel = { gap_down: 'Gap-Down Reversal', earnings_down: 'Earnings Gap Recovery', gap_up: 'Gap-Up Momentum' }[mode] || 'Trade Plan'
    const entryFib = isGapUp ? '0.618' : '0.236'
    const stopDesc = isGapUp ? 'Fib 0.382' : 'PM Low − 1%'
    const lines = [
      `${symbol} — ${strategyLabel}`,
      fib.entryPrice ? `Entry:    $${fib.entryPrice}  (Fib ${entryFib})` : '',
      fib.stopLoss   ? `Stop:     $${fib.stopLoss}  (${stopDesc})` : '',
      fib.target1    ? `Target 1: $${fib.target1}` : '',
      fib.target2    ? `Target 2: $${fib.target2}` : '',
      fib.riskReward ? `R/R:      1:${fib.riskReward}` : '',
      isGapUp
        ? `Gap: $${fib.preMarketLow} (Prev Close) → $${fib.preMarketHigh} (PM High)`
        : `Gap: $${fib.preMarketLow} (PM Low) → $${fib.preMarketHigh} (Prev Close)`,
      `Rule: Wait for first green 1-min candle after 9:30 AM ET`,
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      <Header
        onBack={onBack}
        title={symbol}
        subtitle={profile?.name ?? data.name}
      />

      <div className="pb-24">
        {/* Hero section */}
        <div className="px-4 pt-4">
          {/* Live price ticker */}
          <LivePriceTicker
            symbol={symbol}
            initialPrice={price}
            initialChange={dp}
          />

          {/* Status + company info */}
          <div
            className="mt-3 rounded-xl border p-4"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-lg font-bold truncate" style={{ color: '#f1f5f9' }}>
                  {profile?.name || data.name || symbol}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#64748b' }}>
                  {sector} • {exchange}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Watchlist toggle */}
                <button
                  onClick={handleWatchToggle}
                  className="p-2 rounded-lg"
                  style={{ background: watched ? 'rgba(239,68,68,0.12)' : '#222', minHeight: '36px', minWidth: '36px' }}
                  aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill={watched ? '#ef4444' : 'none'}>
                    <path
                      d="M8 13.5s-6-3.8-6-7.5A3.5 3.5 0 018 3.28 3.5 3.5 0 0114 6c0 3.7-6 7.5-6 7.5z"
                      stroke={watched ? '#ef4444' : '#64748b'}
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {filterResult && <StatusBadge status={filterResult.status} score={liveScore} />}
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-2">
              {mc && <MetricCell label="Mkt Cap" value={formatMarketCap(mc)} />}
              {pe !== null && (
                <MetricCell label="P/E TTM" value={pe > 0 ? pe.toFixed(1) : 'N/A'}
                  valueColor={pe > 0 ? '#22c55e' : '#ef4444'} />
              )}
              {vol !== null && <MetricCell label="Volume" value={formatVol(vol)} />}
              {metrics?.metric?.['52WeekHigh'] && (
                <MetricCell label="52W High" value={`$${metrics.metric['52WeekHigh'].toFixed(2)}`} />
              )}
              {metrics?.metric?.['52WeekLow'] && (
                <MetricCell label="52W Low" value={`$${metrics.metric['52WeekLow'].toFixed(2)}`} />
              )}
              {dp !== null && (
                <MetricCell label="PM Chg" value={`${dp > 0 ? '+' : ''}${dp.toFixed(2)}%`}
                  valueColor={dp < 0 ? '#ef4444' : '#22c55e'} />
              )}
            </div>

            {/* External links row */}
            <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#2a2a2a' }}>
              <a
                href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
                style={{ background: '#222', color: '#94a3b8', border: '1px solid #2a2a2a' }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <polyline points="1,10 4,6 7,8 10,3 12,5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                TradingView Chart
              </a>
              <a
                href={`https://finance.yahoo.com/quote/${symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
                style={{ background: '#222', color: '#94a3b8', border: '1px solid #2a2a2a' }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M11.5 2.5H8M11.5 2.5V6M11.5 2.5L6 8M5 3H2.5C2.224 3 2 3.224 2 3.5v8c0 .276.224.5.5.5h8c.276 0 .5-.224.5-.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Yahoo Finance
              </a>
            </div>
          </div>

          {/* AVOID NEWS ALERT */}
          {hasAvoidNews && (
            <div
              className="mt-3 rounded-xl border p-4"
              style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-bold" style={{ color: '#ef4444' }}>⚠ NEWS AVOID SIGNAL</span>
              </div>
              <p className="text-sm" style={{ color: '#fca5a5' }}>
                {avoidNewsItems.length} headline{avoidNewsItems.length !== 1 ? 's' : ''} contain{avoidNewsItems.length === 1 ? 's' : ''} fundamental damage keywords.
                This trade should be skipped regardless of filter results.
              </p>
              {avoidNewsItems.slice(0, 2).map((n, i) => (
                <p key={i} className="text-xs mt-1.5 italic" style={{ color: '#f87171' }}>
                  "{n.headline}"
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="px-4 mt-4 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: activeTab === tab.id ? '#22c55e15' : '#1a1a1a',
                color: activeTab === tab.id ? '#22c55e' : '#64748b',
                border: `1px solid ${activeTab === tab.id ? '#22c55e40' : '#2a2a2a'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 mt-4">
          {/* Trade Plan tab */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              {/* Fibonacci levels */}
              <Section
                title="Fibonacci Levels"
                subtitle={isGapUp ? 'Prev Close → PM High + extensions' : 'PM Low → Prev Close (gap-fill targets)'}
                action={fib && (
                  <button
                    onClick={handleCopyPlan}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                    style={{ background: '#222', color: copied ? '#22c55e' : '#94a3b8', border: '1px solid #2a2a2a' }}
                  >
                    {copied ? (
                      <>✓ Copied</>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M5 3V2.5A1.5 1.5 0 016.5 1h5A1.5 1.5 0 0113 2.5v5A1.5 1.5 0 0111.5 9H11" stroke="currentColor" strokeWidth="1.4"/>
                        </svg>
                        Copy Plan
                      </>
                    )}
                  </button>
                )}
              >
                <FibTable fib={fib} currentPrice={price} mode={mode} />
              </Section>

              {/* Trade plan */}
              {fib && <TradePlan fib={fib} mode={mode} />}

              {/* Buy Demo button */}
              {fib && fib.entryPrice && (
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #4f6ef7 0%, #7c3aed 100%)',
                    color: '#fff',
                    boxShadow: '0 0 24px rgba(79,110,247,0.3)',
                  }}
                >
                  <span>💼</span>
                  Buy Demo — ${fib.entryPrice.toFixed(2)}
                </button>
              )}

              {/* AmericanBulls */}
              <div
                className="rounded-xl border p-4"
                style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <div className="text-sm font-bold mb-3" style={{ color: '#f1f5f9', letterSpacing: '0.06em' }}>
                  AMERICANBULLS SIGNAL
                </div>
                {abLoading ? (
                  <div className="flex items-center gap-2 mb-3" style={{ color: '#64748b' }}>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2"/>
                      <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-sm">Fetching signal...</span>
                  </div>
                ) : abSignal ? (
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="text-sm font-bold px-3 py-1.5 rounded-lg"
                      style={{
                        background: `${abSignalColor(abSignal)}22`,
                        color: abSignalColor(abSignal),
                        border: `1px solid ${abSignalColor(abSignal)}44`,
                      }}
                    >
                      {abSignal}
                    </span>
                    {abSignal === 'STRONG SELL' && (
                      <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                        AVOID — do not enter
                      </span>
                    )}
                    {abSignal === 'SELL' && (
                      <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                        Caution — monitor closely
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm mb-3" style={{ color: abError ? '#ef4444' : '#64748b' }}>
                    {abError ? `Fetch error — check manually` : 'Signal not found — check manually'}
                  </p>
                )}
                <a
                  href={`https://www.americanbulls.com/SignalPage.aspx?lang=en&Ticker=${symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg"
                  style={{ background: '#222', color: '#64748b', border: '1px solid #2a2a2a' }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M11.5 2.5H8M11.5 2.5V6M11.5 2.5L6 8M5 3H2.5C2.224 3 2 3.224 2 3.5v8c0 .276.224.5.5.5h8c.276 0 .5-.224.5-.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open AmericanBulls — {symbol}
                </a>
              </div>
            </div>
          )}

          {/* Filters tab */}
          {activeTab === 'filters' && (
            <Section title="All Filters" subtitle="All 12 filters must pass for GREEN status">
              {liveFilters ? (
                <FilterList filters={liveFilters} mode={mode} />
              ) : (
                <SkeletonDetail />
              )}
            </Section>
          )}

          {/* News tab */}
          {activeTab === 'news' && (
            <Section title="Today's News" subtitle="Classified by keyword matching">
              <NewsFeed news={newsClassified} />
            </Section>
          )}
        </div>
      </div>
    </div>

    {showBuyModal && fib && (
      <BuyModal
        stockData={data}
        fib={fib}
        onClose={() => setShowBuyModal(false)}
        onBought={() => setShowBuyModal(false)}
      />
    )}
    </>
  )
}

function Section({ title, subtitle, children, action }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#2a2a2a', background: '#222' }}>
        <div>
          <div className="text-sm font-bold" style={{ color: '#f1f5f9', letterSpacing: '0.06em' }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function MetricCell({ label, value, valueColor = '#f1f5f9' }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: '#222' }}>
      <div className="text-xs mb-1" style={{ color: '#64748b' }}>{label}</div>
      <div className="text-sm font-bold font-mono tabular-nums" style={{ color: valueColor }}>{value}</div>
    </div>
  )
}

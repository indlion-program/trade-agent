import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { StatusBadge } from '../components/StatusBadge'
import { FilterList } from '../components/FilterList'
import { FibTable } from '../components/FibTable'
import { TradePlan } from '../components/TradePlan'
import { NewsFeed } from '../components/NewsFeed'
import { LivePriceTicker } from '../components/LivePriceTicker'
import { SkeletonDetail } from '../components/SkeletonCard'
import { fetchFullAnalysis, getPreMarketCandles } from '../services/finnhub'
import { runAllFilters } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { calculateFibLevels, extractPreMarketHL, extractPreMarketHLFromQuote } from '../utils/fibonacci'
import { formatMarketCap, formatVol } from '../utils/filters'
import { isWatched, toggleWatch } from '../services/watchlist'

export function DetailScreen({ stockData: initialData, onBack }) {
  const [data, setData] = useState(initialData)
  const [fib, setFib] = useState(null)
  const [fibLoading, setFibLoading] = useState(true)
  const [americanBullsChecked, setAmericanBullsChecked] = useState(false)
  const [activeTab, setActiveTab] = useState('plan')
  const [watched, setWatched] = useState(() => isWatched(initialData.symbol))
  const [copied, setCopied] = useState(false)

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

  // Load pre-market candles for Fibonacci.
  // /stock/candle is paid-tier only on Finnhub free plan; falls back to /quote h/l.
  useEffect(() => {
    let cancelled = false
    setFibLoading(true)
    getPreMarketCandles(symbol)
      .then((candles) => {
        if (cancelled) return
        const hl = extractPreMarketHL(candles)
        if (hl) {
          setFib(calculateFibLevels(hl.high, hl.low))
          return
        }
        const fallback = extractPreMarketHLFromQuote(quote)
        if (fallback) {
          setFib(calculateFibLevels(fallback.high, fallback.low))
        } else {
          // Try tvData if available (from TradingView screener)
          const tv = data.tvData
          if (tv?.pmHigh && tv?.pmLow) {
            setFib(calculateFibLevels(tv.pmHigh, tv.pmLow))
          } else {
            setFib(null)
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        const fallback = extractPreMarketHLFromQuote(quote)
        if (fallback) {
          setFib(calculateFibLevels(fallback.high, fallback.low))
        } else {
          const tv = data.tvData
          setFib(tv?.pmHigh && tv?.pmLow ? calculateFibLevels(tv.pmHigh, tv.pmLow) : null)
        }
      })
      .finally(() => {
        if (!cancelled) setFibLoading(false)
      })
    return () => { cancelled = true }
  }, [symbol, quote, data.tvData])

  // Refresh full data in background
  useEffect(() => {
    fetchFullAnalysis(symbol).then(raw => {
      const filterResult = runAllFilters(raw)
      const newsClassified = classifyNewsList(raw.news || [])
      setData({ ...raw, filterResult, newsClassified })
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

  const hasAvoidNews = newsClassified.some(n => n.classification === 'AVOID')
  const avoidNewsItems = newsClassified.filter(n => n.classification === 'AVOID')

  const tabs = [
    { id: 'plan', label: 'Trade Plan' },
    { id: 'filters', label: `Filters (${filterResult?.hardFails ?? 0} fail)` },
    { id: 'news', label: `News (${newsClassified.length})` },
  ]

  function handleWatchToggle() {
    const nowWatched = toggleWatch(symbol)
    setWatched(nowWatched)
  }

  function handleCopyPlan() {
    if (!fib) return
    const lines = [
      `${symbol} — Gap-Reversal Trade Plan`,
      `Entry:    $${fib.entryPrice}  (0.382 Fib)`,
      `Stop:     $${fib.stopLoss}  (PM Low − 1.5%)`,
      `Target 1: $${fib.target1}  (0.5 Fib)`,
      `Target 2: $${fib.target2}  (0.618 Fib)`,
      `Target 3: $${fib.target3}  (0.786 Fib)`,
      fib.riskReward ? `R/R:      ${fib.riskReward}x` : '',
      `PM Range: $${fib.preMarketLow} – $${fib.preMarketHigh}`,
      `Rule: Wait for first green 1-min candle after 9:30 AM ET`,
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
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
                {filterResult && <StatusBadge status={filterResult.status} />}
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
                subtitle="Pre-market range"
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
                {fibLoading ? (
                  <div className="py-6 flex items-center justify-center gap-2" style={{ color: '#64748b' }}>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2"/>
                      <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-sm">Loading candles...</span>
                  </div>
                ) : (
                  <FibTable fib={fib} currentPrice={price} />
                )}
              </Section>

              {/* Trade plan */}
              {fib && <TradePlan fib={fib} />}

              {/* AmericanBulls */}
              <div
                className="rounded-xl border p-4"
                style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <div className="text-sm font-bold mb-2" style={{ color: '#f1f5f9', letterSpacing: '0.06em' }}>
                  AMERICANBULLS CHECK
                </div>
                <p className="text-sm mb-3" style={{ color: '#64748b' }}>
                  Verify the signal at AmericanBulls.com before entering.
                  If signal is SELL or STRONG SELL — skip this trade.
                </p>
                <a
                  href={`https://americanbulls.com/SignalPage.aspx?lang=en&Ticker=${symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold py-2.5 px-4 rounded-lg mb-3"
                  style={{ background: '#222', color: '#22c55e', border: '1px solid #2a2a2a' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M11.5 2.5H8M11.5 2.5V6M11.5 2.5L6 8M5 3H2.5C2.224 3 2 3.224 2 3.5v8c0 .276.224.5.5.5h8c.276 0 .5-.224.5-.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open AmericanBulls — {symbol}
                </a>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={americanBullsChecked}
                    onChange={e => setAmericanBullsChecked(e.target.checked)}
                    className="w-5 h-5 rounded"
                    style={{ accentColor: '#22c55e' }}
                  />
                  <span className="text-sm" style={{ color: '#94a3b8' }}>
                    I checked AmericanBulls — signal is not SELL / STRONG SELL
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Filters tab */}
          {activeTab === 'filters' && (
            <Section title="All Filters" subtitle="All 10 must pass for GREEN status">
              {filterResult ? (
                <FilterList filters={filterResult.filters} />
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

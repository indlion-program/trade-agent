import { useState, useCallback, useEffect } from 'react'
import { Header } from '../components/Header'
import { StockCard } from '../components/StockCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { ScanProgress } from '../components/ScanProgress'
import { UniverseSelector } from '../components/UniverseSelector'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScanner } from '../hooks/useScanner'
import { fetchLightAnalysis, clearCache } from '../services/finnhub'
import { tvSingleStock } from '../services/tradingview'
import { runAllFilters, STRATEGY_CONFIG } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { UNIVERSE_GROUPS } from '../data/universe'
import { getWatchlist } from '../services/watchlist'

const STORAGE_KEY = 'scanner-state-v4'

function loadPersisted() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') }
  catch { return null }
}
function savePersisted(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

// gap_down and pre_market_gap are the primary modes
const STRATEGY_MODES = ['gap_down', 'pre_market_gap', 'earnings_down', 'gap_up']

export function ScannerScreen({ onSelectStock }) {
  const { state: scanState, scan, cancel, reset } = useScanner()
  const persisted = loadPersisted()

  const [universeId, setUniverseId] = useState(persisted?.universeId || 'all')
  const [fullUniverse, setFullUniverse] = useState(persisted?.fullUniverse || null)
  const [strategyMode, setStrategyMode] = useState(persisted?.strategyMode || 'gap_down')
  const [searchResults, setSearchResults] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [sortMode, setSortMode] = useState('drop')
  const [filterMode, setFilterMode] = useState('all')
  const [watchlist, setWatchlist] = useState(() => getWatchlist())

  useEffect(() => {
    savePersisted({ universeId, fullUniverse, strategyMode })
  }, [universeId, fullUniverse, strategyMode])

  useEffect(() => {
    function handle() { setWatchlist(getWatchlist()) }
    window.addEventListener('watchlistChange', handle)
    return () => window.removeEventListener('watchlistChange', handle)
  }, [])

  // null means no universe filter — show all TV screener results
  const currentUniverse =
    universeId === 'all'  ? null :
    universeId === 'full' && fullUniverse ? fullUniverse :
    UNIVERSE_GROUPS[universeId] ?? null

  const handleScan = useCallback(async () => {
    await scan(currentUniverse, { mode: strategyMode })
  }, [currentUniverse, scan, strategyMode])

  const handleRefresh = useCallback(async () => {
    await clearCache()
    reset()
    handleScan()
  }, [reset, handleScan])

  const { pulling, pullY } = usePullToRefresh(handleRefresh)

  // Search uses TV screener (no Finnhub REST) → then Yahoo RSS for news
  const handleSearch = useCallback(async (e) => {
    e.preventDefault()
    const sym = searchQuery.trim().toUpperCase()
    if (!sym) return
    setSearching(true)
    try {
      const tvStock = await tvSingleStock(sym)
      const raw = await fetchLightAnalysis(sym, tvStock.quote, tvStock.tvData, null)
      const filterResult = runAllFilters(raw, strategyMode)
      const newsClassified = classifyNewsList(raw.news || [])
      const data = { ...raw, tvData: tvStock.tvData, filterResult, newsClassified, mode: strategyMode }
      setSearchResults(prev => ({ ...prev, [sym]: data }))
      onSelectStock(data)
    } catch (err) {
      alert(`Failed to load ${sym}: ${err.message}`)
    } finally {
      setSearching(false)
      setSearchQuery('')
    }
  }, [searchQuery, strategyMode, onSelectStock])

  const handleStrategyChange = useCallback((mode) => {
    setStrategyMode(mode)
    reset()
    setSearchResults({})
  }, [reset])

  const candidateDisplay = scanState.candidates.map(({ symbol, quote, tvData }) => {
    const analysis = scanState.analyses[symbol]
    if (analysis) return analysis
    return {
      symbol, quote, tvData, profile: null, mode: strategyMode,
      filterResult: { status: 'AMBER', filters: {}, score: 0 },
      newsClassified: [],
      _pending: true,
    }
  })

  const isUp = strategyMode === 'gap_up'

  const sorted = [...candidateDisplay].sort((a, b) => {
    if (sortMode === 'status') {
      const order = { GREEN: 0, AMBER: 1, RED: 2 }
      return (order[a.filterResult?.status] ?? 3) - (order[b.filterResult?.status] ?? 3)
    }
    if (sortMode === 'score') {
      return (b.filterResult?.score ?? 0) - (a.filterResult?.score ?? 0)
    }
    return isUp
      ? (b.quote?.dp ?? 0) - (a.quote?.dp ?? 0)
      : (a.quote?.dp ?? 0) - (b.quote?.dp ?? 0)
  })

  const filtered = sorted.filter(d => {
    if (filterMode === 'watch') return watchlist.includes(d.symbol)
    if (filterMode === 'all') return true
    return d.filterResult?.status === filterMode.toUpperCase()
  })

  const searchOnly = Object.values(searchResults).filter(
    d => !sorted.find(s => s.symbol === d.symbol)
  )

  const greenCount = candidateDisplay.filter(d => d.filterResult?.status === 'GREEN').length
  const amberCount = candidateDisplay.filter(d => d.filterResult?.status === 'AMBER').length
  const redCount   = candidateDisplay.filter(d => d.filterResult?.status === 'RED').length
  const watchCount = candidateDisplay.filter(d => watchlist.includes(d.symbol)).length

  const isScanning =
    scanState.phase === 'tv_scan' || scanState.phase === 'pass1' || scanState.phase === 'pass2'

  const cfg = STRATEGY_CONFIG[strategyMode] ?? STRATEGY_CONFIG.gap_down

  const modeLabels = {
    gap_down:       'Gap Down',
    pre_market_gap: 'PM Gap',
    earnings_down:  'Earnings',
    gap_up:         'Gap Up',
  }

  const modeColors = {
    gap_down:       '#f59e0b',
    pre_market_gap: '#ef4444',
    earnings_down:  '#a855f7',
    gap_up:         '#22c55e',
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      <Header />

      {pulling && (
        <div className="ptr-indicator" style={{ height: pullY, overflow: 'hidden',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px' }}>
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#64748b" strokeWidth="2" />
            <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div className="px-4 pt-4 pb-24">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value.toUpperCase())}
            placeholder="Look up any ticker (e.g. AAPL)"
            className="flex-1 rounded-xl px-4 py-3 text-base font-medium border outline-none"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#f1f5f9' }}
            maxLength={10} autoCapitalize="characters" autoCorrect="off"
            autoComplete="off" spellCheck={false}
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || searching}
            className="px-4 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
            style={{ background: '#22c55e', color: '#0f0f0f', minWidth: '80px' }}
          >
            {searching ? '...' : 'Search'}
          </button>
        </form>

        {/* Strategy mode pills */}
        <div className="mb-4">
          <div className="text-xs font-semibold mb-2" style={{ color: '#64748b', letterSpacing: '0.06em' }}>
            SCAN MODE
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STRATEGY_MODES.map(m => {
              const active = strategyMode === m
              const col = modeColors[m] ?? '#94a3b8'
              return (
                <button
                  key={m}
                  onClick={() => handleStrategyChange(m)}
                  className="py-2 px-3 rounded-xl text-xs font-bold"
                  style={{
                    background: active ? `${col}18` : '#1a1a1a',
                    color: active ? col : '#64748b',
                    border: `1px solid ${active ? col + '40' : '#2a2a2a'}`,
                  }}
                >
                  {modeLabels[m] ?? m}
                </button>
              )
            })}
          </div>
          <div className="text-xs mt-1.5" style={{ color: '#475569' }}>
            {cfg.label}
            {cfg.minDrop ? ` · ≤${cfg.minDrop}% gap` : cfg.minGain ? ` · ≥+${cfg.minGain}%` : ''}
            {` · ≥$${cfg.minPrice} · ≥${(cfg.minAvgVol / 1000).toFixed(0)}K avg vol`}
            {cfg.minPE ? ` · P/E>${cfg.minPE}` : ''}
            {cfg.minPmVol ? ` · ≥${(cfg.minPmVol / 1000).toFixed(0)}K PM vol` : ''}
          </div>
        </div>

        {/* Universe picker */}
        <UniverseSelector
          value={universeId}
          fullUniverse={fullUniverse}
          onChange={setUniverseId}
          onExpandUniverse={symbols => { setFullUniverse(symbols); setUniverseId('full') }}
        />

        {/* Scan button */}
        <button
          onClick={isScanning ? cancel : handleScan}
          className="w-full py-3.5 rounded-xl font-bold text-base mb-4 flex items-center justify-center gap-2"
          style={{
            background: isScanning ? '#3a1e1e' : '#1e3a2f',
            color: isScanning ? '#ef4444' : '#22c55e',
            border: '1px solid',
            borderColor: isScanning ? '#ef444440' : '#22c55e40',
          }}
        >
          {isScanning ? <>⏹ Stop Scan</> : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              ⚡ Scan — {cfg.label}
            </>
          )}
        </button>

        {/* Progress */}
        {scanState.phase !== 'idle' && <ScanProgress state={scanState} onCancel={cancel} />}

        {/* Error */}
        {scanState.error && (
          <div className="rounded-xl border px-4 py-3 mb-3 text-sm" style={{ background: '#1a0a0a', borderColor: '#ef444440', color: '#fca5a5' }}>
            ⚠ {scanState.error}
          </div>
        )}

        {/* Filter pills + sort */}
        {candidateDisplay.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              <FilterPill active={filterMode === 'all'}   onClick={() => setFilterMode('all')}   label="All"   count={candidateDisplay.length} />
              <FilterPill active={filterMode === 'green'} onClick={() => setFilterMode('green')} label="GREEN" count={greenCount} color="#22c55e" />
              <FilterPill active={filterMode === 'amber'} onClick={() => setFilterMode('amber')} label="AMBER" count={amberCount} color="#f59e0b" />
              <FilterPill active={filterMode === 'red'}   onClick={() => setFilterMode('red')}   label="AVOID" count={redCount}   color="#ef4444" />
              {watchCount > 0 && (
                <FilterPill active={filterMode === 'watch'} onClick={() => setFilterMode('watch')} label="♥ Watch" count={watchCount} color="#f87171" />
              )}
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs" style={{ color: '#64748b' }}>
                {filtered.length} of {candidateDisplay.length} stocks
                {scanState.tvMode && <span style={{ color: '#22c55e' }}> · ⚡ instant</span>}
              </span>
              <div className="flex gap-1.5 text-xs">
                {[
                  { id: 'drop', label: isUp ? '↑ Gain' : '↓ Drop' },
                  { id: 'score', label: '★ Score' },
                  { id: 'status', label: 'Status' },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setSortMode(id)}
                    className="px-2 py-1 rounded font-semibold"
                    style={{
                      background: sortMode === id ? '#22c55e20' : '#1a1a1a',
                      color: sortMode === id ? '#22c55e' : '#64748b',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* No results banner */}
        {scanState.phase === 'done' && candidateDisplay.length === 0 && searchOnly.length === 0 && (
          <div className="rounded-xl border p-5 text-center" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
            <div className="text-3xl mb-3">📭</div>
            <div className="text-sm font-semibold mb-1" style={{ color: '#f1f5f9' }}>No stocks found</div>
            <div className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
              {strategyMode === 'pre_market_gap'
                ? 'Pre-Market Gap requires live pre-market data (4–9:30 AM ET on weekdays). Try Gap Down for anytime scanning.'
                : 'No stocks matched the criteria. Try Gap Down mode — it works 24/7 using the daily change field.'}
            </div>
          </div>
        )}

        {/* Idle empty state */}
        {scanState.phase === 'idle' && candidateDisplay.length === 0 && searchOnly.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">⚡</div>
            <div className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>
              Gap Stock Scanner
            </div>
            <div className="text-sm mb-4" style={{ color: '#64748b' }}>
              <strong style={{ color: '#f59e0b' }}>Gap Down</strong> — price&gt;$5, P/E&gt;4, avg vol&gt;700K, works 24/7
              <br />
              <strong style={{ color: '#ef4444' }}>PM Gap</strong> — gap&lt;-5%, PM vol&gt;60K, pre-market hours only
            </div>
            <div className="inline-block text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#1a1a1a', color: '#94a3b8', border: '1px solid #2a2a2a' }}>
              Scans all NASDAQ + NYSE via TradingView · No API key needed
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {searchOnly.map(data => (
            <StockCard key={`s-${data.symbol}`} data={data} onClick={() => onSelectStock(data)} />
          ))}
          {filtered.map(data => (
            <StockCard key={data.symbol} data={data}
              onClick={() => !data._pending && onSelectStock(data)} />
          ))}
          {scanState.phase === 'pass2' &&
            scanState.candidates.length > scanState.pass2Done &&
            Array.from({ length: Math.min(3, scanState.candidates.length - scanState.pass2Done) }).map(
              (_, i) => <SkeletonCard key={`pending-${i}`} />
            )}
        </div>
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, label, count, color = '#94a3b8' }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
      style={{
        background: active ? `${color}20` : '#1a1a1a',
        color: active ? color : '#64748b',
        border: `1px solid ${active ? color + '40' : '#2a2a2a'}`,
        minHeight: '32px',
      }}
    >
      {label} <span className="font-mono tabular-nums">{count}</span>
    </button>
  )
}

import { useState, useCallback, useEffect } from 'react'
import { Header } from '../components/Header'
import { StockCard } from '../components/StockCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { ScanProgress } from '../components/ScanProgress'
import { UniverseSelector } from '../components/UniverseSelector'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScanner } from '../hooks/useScanner'
import { fetchFullAnalysis, clearCache } from '../services/finnhub'
import { runAllFilters, STRATEGY_CONFIG } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { UNIVERSE_GROUPS } from '../data/universe'
import { getWatchlist } from '../services/watchlist'

const STORAGE_KEY = 'scanner-state-v3'

function loadPersisted() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') }
  catch { return null }
}
function savePersisted(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

const STRATEGY_MODES = ['gap_down', 'earnings_down', 'gap_up']

export function ScannerScreen({ onSelectStock }) {
  const { state: scanState, scan, cancel, reset } = useScanner()
  const persisted = loadPersisted()

  const [universeId, setUniverseId] = useState(persisted?.universeId || 'curated')
  const [fullUniverse, setFullUniverse] = useState(persisted?.fullUniverse || null)
  const [strategyMode, setStrategyMode] = useState(persisted?.strategyMode || 'gap_down')
  const [searchResults, setSearchResults] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [sortMode, setSortMode] = useState('drop')   // drop | status | score
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

  const currentUniverse =
    universeId === 'full' && fullUniverse ? fullUniverse :
    universeId === 'large_us' ? null :           // null = TV screener all results, no post-filter
    UNIVERSE_GROUPS[universeId] || UNIVERSE_GROUPS.curated

  const handleScan = useCallback(async () => {
    // large_us / null → pass [] so scanner skips symbol post-filtering (TV screener enforces >$500M)
    // others → pass symbol list
    await scan(currentUniverse ?? [], { mode: strategyMode })
  }, [currentUniverse, scan, strategyMode])

  const handleRefresh = useCallback(async () => {
    await clearCache()
    reset()
    handleScan()
  }, [reset, handleScan])

  const { pulling, pullY } = usePullToRefresh(handleRefresh)

  const handleSearch = useCallback(async (e) => {
    e.preventDefault()
    const sym = searchQuery.trim().toUpperCase()
    if (!sym) return
    setSearching(true)
    try {
      const raw = await fetchFullAnalysis(sym)
      const filterResult = runAllFilters(raw, strategyMode)
      const newsClassified = classifyNewsList(raw.news || [])
      const data = { ...raw, filterResult, newsClassified, mode: strategyMode }
      setSearchResults(prev => ({ ...prev, [sym]: data }))
      onSelectStock(data)
    } catch (err) {
      alert(`Failed to load ${sym}: ${err.message}`)
    } finally {
      setSearching(false)
      setSearchQuery('')
    }
  }, [searchQuery, strategyMode, onSelectStock])

  // Reset scan results when strategy mode changes
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
    // drop / gain sort
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

  const cfg = STRATEGY_CONFIG[strategyMode]

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
            placeholder="Look up any ticker (e.g. CHKP)"
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
            {searching ? '...' : 'Analyze'}
          </button>
        </form>

        {/* Strategy mode toggle */}
        <div className="mb-4">
          <div className="text-xs font-semibold mb-2" style={{ color: '#64748b', letterSpacing: '0.06em' }}>
            STRATEGY
          </div>
          <div className="flex gap-1.5">
            {STRATEGY_MODES.map(m => {
              const active = strategyMode === m
              const col = m === 'gap_up' ? '#22c55e' : m === 'gap_down' ? '#f59e0b' : '#ef4444'
              const labels = { gap_down: 'Gap Down', earnings_down: 'Earnings Drop', gap_up: 'Gap Up' }
              return (
                <button
                  key={m}
                  onClick={() => handleStrategyChange(m)}
                  className="flex-1 py-2 px-1.5 rounded-xl text-xs font-bold"
                  style={{
                    background: active ? `${col}18` : '#1a1a1a',
                    color: active ? col : '#64748b',
                    border: `1px solid ${active ? col + '40' : '#2a2a2a'}`,
                  }}
                >
                  {labels[m]}
                </button>
              )
            })}
          </div>
          <div className="text-xs mt-1.5" style={{ color: '#475569' }}>
            {cfg.label} · {isUp ? `≥+${cfg.minGain}%` : `≤${cfg.minDrop}%`} gap · ≥${cfg.minPrice} · ≥${(cfg.minMarketCap/1e9).toFixed(0)}B cap
          </div>
        </div>

        {/* TV Scan tip */}
        {scanState.phase === 'idle' && candidateDisplay.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-3 border"
            style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
            <span style={{ color: '#22c55e', fontSize: '18px' }}>⚡</span>
            <span className="text-xs" style={{ color: '#86efac' }}>
              Instant scan via TradingView — all US stocks in one shot, no API limit
            </span>
          </div>
        )}

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
          disabled={!isScanning && currentUniverse.length === 0}
          className="w-full py-3.5 rounded-xl font-bold text-base mb-4 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{
            background: isScanning ? '#3a1e1e' : '#1e3a2f',
            color: isScanning ? '#ef4444' : '#22c55e',
            border: '1px solid',
            borderColor: isScanning ? '#ef444440' : '#22c55e40',
          }}
        >
          {isScanning ? <>Stop Scan</> : (
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
                {filtered.length} of {candidateDisplay.length} candidates
                {scanState.tvMode && <span style={{ color: '#22c55e' }}> · ⚡ instant</span>}
              </span>
              <div className="flex gap-1.5 text-xs">
                {[
                  { id: 'drop', label: isUp ? '↑ Biggest gain' : '↓ Biggest drop' },
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

        {/* Empty state */}
        {scanState.phase === 'idle' && candidateDisplay.length === 0 && searchOnly.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⚡</div>
            <div className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>
              Instant Gap Scanner
            </div>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Scans all US stocks via TradingView in seconds.
              <br />
              Full Finnhub analysis runs only on gap candidates.
            </div>
            <div className="mt-6 inline-block text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#1a1a1a', color: '#94a3b8', border: '1px solid #2a2a2a' }}>
              Best used during pre-market hours (4 AM – 9:30 AM ET)
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

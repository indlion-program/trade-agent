import { useState, useCallback, useEffect } from 'react'
import { Header } from '../components/Header'
import { StockCard } from '../components/StockCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { ScanProgress } from '../components/ScanProgress'
import { UniverseSelector } from '../components/UniverseSelector'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScanner } from '../hooks/useScanner'
import { fetchFullAnalysis, clearCache } from '../services/finnhub'
import { runAllFilters } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { UNIVERSE_GROUPS } from '../data/universe'

const STORAGE_KEY = 'scanner-state-v2'

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function savePersisted(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

export function ScannerScreen({ onSelectStock }) {
  const { state: scanState, scan, cancel, reset } = useScanner()
  const persisted = loadPersisted()

  const [universeId, setUniverseId] = useState(persisted?.universeId || 'curated')
  const [fullUniverse, setFullUniverse] = useState(persisted?.fullUniverse || null)
  const [searchResults, setSearchResults] = useState({}) // ad-hoc lookups
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [sortMode, setSortMode] = useState('drop') // drop | status | rr
  const [filterMode, setFilterMode] = useState('all') // all | green | amber | red

  // Persist universe choice + full universe cache
  useEffect(() => {
    savePersisted({ universeId, fullUniverse })
  }, [universeId, fullUniverse])

  const currentUniverse =
    universeId === 'full' && fullUniverse ? fullUniverse : UNIVERSE_GROUPS[universeId] || []

  const handleScan = useCallback(async () => {
    if (currentUniverse.length === 0) return
    await scan(currentUniverse)
  }, [currentUniverse, scan])

  const handleRefresh = useCallback(async () => {
    await clearCache()
    reset()
    handleScan()
  }, [reset, handleScan])

  const { pulling, pullY } = usePullToRefresh(handleRefresh)

  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault()
      const sym = searchQuery.trim().toUpperCase()
      if (!sym) return
      setSearching(true)
      try {
        const raw = await fetchFullAnalysis(sym)
        const filterResult = runAllFilters(raw)
        const newsClassified = classifyNewsList(raw.news || [])
        const data = { ...raw, filterResult, newsClassified }
        setSearchResults((prev) => ({ ...prev, [sym]: data }))
        // Auto-open detail
        onSelectStock(data)
      } catch (err) {
        alert(`Failed to load ${sym}: ${err.message}`)
      } finally {
        setSearching(false)
        setSearchQuery('')
      }
    },
    [searchQuery, onSelectStock]
  )

  // Combine candidate list with their analyses (or quote-only for in-flight)
  const candidateDisplay = scanState.candidates.map(({ symbol, quote }) => {
    const analysis = scanState.analyses[symbol]
    if (analysis) return analysis
    // Fallback while pass 2 hasn't reached this candidate yet
    return {
      symbol,
      quote,
      profile: null,
      filterResult: { status: 'AMBER', filters: {} },
      newsClassified: [],
      _pending: true,
    }
  })

  // Sort
  const sorted = [...candidateDisplay].sort((a, b) => {
    if (sortMode === 'status') {
      const order = { GREEN: 0, AMBER: 1, RED: 2 }
      return (order[a.filterResult?.status] ?? 3) - (order[b.filterResult?.status] ?? 3)
    }
    return (a.quote?.dp ?? 0) - (b.quote?.dp ?? 0)
  })

  // Filter
  const filtered = sorted.filter((d) => {
    if (filterMode === 'all') return true
    return d.filterResult?.status === filterMode.toUpperCase()
  })

  const searchOnly = Object.values(searchResults).filter(
    (d) => !sorted.find((s) => s.symbol === d.symbol)
  )

  const greenCount = candidateDisplay.filter((d) => d.filterResult?.status === 'GREEN').length
  const amberCount = candidateDisplay.filter((d) => d.filterResult?.status === 'AMBER').length
  const redCount = candidateDisplay.filter((d) => d.filterResult?.status === 'RED').length

  const isScanning = scanState.phase === 'pass1' || scanState.phase === 'pass2'

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      <Header />

      {pulling && (
        <div
          className="ptr-indicator"
          style={{
            height: pullY,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '8px',
          }}
        >
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
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            placeholder="Look up any ticker (e.g. CHKP)"
            className="flex-1 rounded-xl px-4 py-3 text-base font-medium border outline-none"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#f1f5f9' }}
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
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

        {/* Universe picker */}
        <UniverseSelector
          value={universeId}
          fullUniverse={fullUniverse}
          onChange={setUniverseId}
          onExpandUniverse={(symbols) => {
            setFullUniverse(symbols)
            setUniverseId('full')
          }}
        />

        {/* Scan button */}
        <button
          onClick={isScanning ? cancel : handleScan}
          disabled={currentUniverse.length === 0}
          className="w-full py-3.5 rounded-xl font-bold text-base mb-4 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{
            background: isScanning ? '#3a1e1e' : '#1e3a2f',
            color: isScanning ? '#ef4444' : '#22c55e',
            border: '1px solid',
            borderColor: isScanning ? '#ef444440' : '#22c55e40',
          }}
        >
          {isScanning ? (
            <>Stop Scan</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Scan {currentUniverse.length.toLocaleString()} Symbols
            </>
          )}
        </button>

        {/* Progress */}
        {scanState.phase !== 'idle' && <ScanProgress state={scanState} onCancel={cancel} />}

        {/* Filter pills */}
        {candidateDisplay.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              <FilterPill
                active={filterMode === 'all'}
                onClick={() => setFilterMode('all')}
                label="All"
                count={candidateDisplay.length}
              />
              <FilterPill
                active={filterMode === 'green'}
                onClick={() => setFilterMode('green')}
                label="GREEN"
                count={greenCount}
                color="#22c55e"
              />
              <FilterPill
                active={filterMode === 'amber'}
                onClick={() => setFilterMode('amber')}
                label="AMBER"
                count={amberCount}
                color="#f59e0b"
              />
              <FilterPill
                active={filterMode === 'red'}
                onClick={() => setFilterMode('red')}
                label="AVOID"
                count={redCount}
                color="#ef4444"
              />
            </div>

            {/* Sort toggle */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs" style={{ color: '#64748b' }}>
                {filtered.length} of {candidateDisplay.length} candidates
              </span>
              <div className="flex gap-1.5 text-xs">
                <button
                  onClick={() => setSortMode('drop')}
                  className="px-2 py-1 rounded font-semibold"
                  style={{
                    background: sortMode === 'drop' ? '#22c55e20' : '#1a1a1a',
                    color: sortMode === 'drop' ? '#22c55e' : '#64748b',
                  }}
                >
                  ↓ Biggest drop
                </button>
                <button
                  onClick={() => setSortMode('status')}
                  className="px-2 py-1 rounded font-semibold"
                  style={{
                    background: sortMode === 'status' ? '#22c55e20' : '#1a1a1a',
                    color: sortMode === 'status' ? '#22c55e' : '#64748b',
                  }}
                >
                  Status
                </button>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {scanState.phase === 'idle' && candidateDisplay.length === 0 && searchOnly.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📡</div>
            <div className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>
              Ready to Scan
            </div>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Pre-screens every symbol with 1 cheap API call,
              <br />
              then runs full analysis on candidates that drop ≥5%.
            </div>
            <div
              className="mt-6 inline-block text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#1a1a1a', color: '#94a3b8', border: '1px solid #2a2a2a' }}
            >
              Tip — use pre-market hours for full universe scans
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {searchOnly.map((data) => (
            <StockCard key={`s-${data.symbol}`} data={data} onClick={() => onSelectStock(data)} />
          ))}
          {filtered.map((data) => (
            <StockCard
              key={data.symbol}
              data={data}
              onClick={() => !data._pending && onSelectStock(data)}
            />
          ))}
          {/* Skeleton placeholders for pass-2 work in progress */}
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
    <button
      onClick={onClick}
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

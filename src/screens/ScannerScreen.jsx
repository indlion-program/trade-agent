import { useState, useCallback, useRef } from 'react'
import { Header } from '../components/Header'
import { StockCard } from '../components/StockCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { fetchFullAnalysis, clearCache } from '../services/finnhub'
import { runAllFilters } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'

const WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN',
  'NVDA', 'JPM', 'BAC', 'GS', 'V',
  'MA', 'CHKP', 'CRM', 'ORCL', 'INTC',
  'AMD', 'TSLA', 'WMT', 'JNJ', 'PFE',
]

export function ScannerScreen({ onSelectStock }) {
  const [results, setResults] = useState({})
  const [scanning, setScanning] = useState(false)
  const [loadingSymbols, setLoadingSymbols] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode] = useState('drop') // 'drop' | 'status'
  const abortRef = useRef(false)

  const processSymbol = useCallback(async (symbol) => {
    setLoadingSymbols(prev => new Set(prev).add(symbol))
    try {
      const raw = await fetchFullAnalysis(symbol)
      const filterResult = runAllFilters(raw)
      const newsClassified = classifyNewsList(raw.news || [])
      setResults(prev => ({
        ...prev,
        [symbol]: { ...raw, filterResult, newsClassified },
      }))
    } catch (e) {
      setResults(prev => ({
        ...prev,
        [symbol]: { symbol, quote: null, profile: null, filterResult: { status: 'AMBER' }, newsClassified: [] },
      }))
    } finally {
      setLoadingSymbols(prev => {
        const next = new Set(prev)
        next.delete(symbol)
        return next
      })
    }
  }, [])

  const scanAll = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setResults({})
    abortRef.current = false

    // Process in batches of 5 to respect rate limits
    const batch = 5
    for (let i = 0; i < WATCHLIST.length; i += batch) {
      if (abortRef.current) break
      const chunk = WATCHLIST.slice(i, i + batch)
      await Promise.all(chunk.map(processSymbol))
    }
    setScanning(false)
  }, [scanning, processSymbol])

  const handleRefresh = useCallback(() => {
    clearCache()
    scanAll()
  }, [scanAll])

  const { pulling, pullY } = usePullToRefresh(handleRefresh)

  // Handle search
  const handleSearch = useCallback(async (e) => {
    e.preventDefault()
    const sym = searchQuery.trim().toUpperCase()
    if (!sym) return
    await processSymbol(sym)
    setSearchQuery('')
  }, [searchQuery, processSymbol])

  // Sort results
  const sortedSymbols = [...WATCHLIST].sort((a, b) => {
    const ra = results[a]
    const rb = results[b]
    if (!ra && !rb) return 0
    if (!ra) return 1
    if (!rb) return -1
    const dpA = ra.quote?.dp ?? 0
    const dpB = rb.quote?.dp ?? 0
    return dpA - dpB // Most negative first
  })

  // Include any custom searched symbols not in watchlist
  const customSymbols = Object.keys(results).filter(s => !WATCHLIST.includes(s))
  const allSymbols = [...customSymbols, ...sortedSymbols]

  const hasResults = Object.keys(results).length > 0
  const loadedCount = Object.keys(results).length
  const totalScanning = WATCHLIST.length

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      <Header />

      {/* Pull-to-refresh indicator */}
      {pulling && (
        <div className="ptr-indicator" style={{ height: pullY, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px' }}>
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#64748b" strokeWidth="2"/>
            <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
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
            placeholder="Enter ticker (e.g. CHKP)"
            className="flex-1 rounded-xl px-4 py-3 text-base font-medium border outline-none focus:border-green-500/50 transition-colors"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#f1f5f9' }}
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!searchQuery.trim()}
            className="px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40"
            style={{ background: '#22c55e', color: '#0f0f0f', minWidth: '72px' }}
          >
            Analyze
          </button>
        </form>

        {/* Scan All button */}
        <button
          onClick={scanAll}
          disabled={scanning}
          className="w-full py-3.5 rounded-xl font-bold text-base mb-6 transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: scanning ? '#1a1a1a' : '#1e3a2f', color: scanning ? '#64748b' : '#22c55e', border: '1px solid', borderColor: scanning ? '#2a2a2a' : '#22c55e40' }}
        >
          {scanning ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#2a2a2a" strokeWidth="2"/>
                <path d="M12 2a10 10 0 010 20" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Scanning {loadedCount}/{totalScanning}...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Scan All {WATCHLIST.length} Stocks
            </>
          )}
        </button>

        {/* Results */}
        {!hasResults && !scanning && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📡</div>
            <div className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>Ready to Scan</div>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Tap "Scan All" to run gap-reversal filters on {WATCHLIST.length} large-cap stocks,<br/>or search any ticker above.
            </div>
            <div className="mt-6 text-xs" style={{ color: '#475569' }}>
              Powered by Finnhub API • Gap-reversal strategy
            </div>
          </div>
        )}

        {hasResults && (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#64748b' }}>
              {loadedCount} stock{loadedCount !== 1 ? 's' : ''} analyzed
            </span>
            <span className="text-xs" style={{ color: '#475569' }}>
              sorted by biggest drop
            </span>
          </div>
        )}

        <div className="space-y-3">
          {allSymbols.map(symbol => {
            const data = results[symbol]
            const isLoading = loadingSymbols.has(symbol)

            if (isLoading || (!data && scanning)) {
              return <SkeletonCard key={symbol} />
            }
            if (!data) return null

            return (
              <StockCard
                key={symbol}
                data={data}
                onClick={() => onSelectStock(data)}
              />
            )
          })}

          {/* Loading skeletons for remaining */}
          {scanning && loadingSymbols.size > 0 && [...loadingSymbols].slice(0, 3).map(s => (
            <SkeletonCard key={`skel-${s}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

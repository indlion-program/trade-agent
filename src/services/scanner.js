// Two-pass scanner.
//
// PASS 1 (cheap): one /quote call per symbol → filter for dp ≤ -5%,
//   price > $3, volume ≥ 50K. This is THE bottleneck win.
//   60 calls/min × 5h pre-market = 18,000 stocks scannable.
//
// PASS 2 (full): for each pass-1 candidate, fetch 5 more endpoints
//   (profile, metrics, news, earnings, splits) to run all 10 filters.

import { getQuote, fetchFullAnalysis, getUsSymbols } from './finnhub'
import { runAllFilters } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { filterTradeableSymbols } from '../data/universe'

// Pre-screen thresholds (slightly looser than full filters to catch edge cases)
const PRESCREEN = {
  minDrop: -5.0, // dp must be ≤ this
  minPrice: 3.0, // c must be > this
  minVol: 50_000, // v must be ≥ this
}

function quotePassesPrescreen(quote) {
  if (!quote) return false
  const { dp, c, v } = quote
  if (dp === null || dp === undefined) return false
  if (c === null || c === undefined) return false
  if (dp > PRESCREEN.minDrop) return false
  if (c <= PRESCREEN.minPrice) return false
  if (v !== null && v !== undefined && v < PRESCREEN.minVol) return false
  return true
}

export function createScanner() {
  let state = {
    phase: 'idle', // idle | pass1 | pass2 | done | cancelled
    total: 0,
    pass1Done: 0,
    pass1Errors: 0,
    candidates: [], // { symbol, quote } — pass-1 survivors
    analyses: {}, // symbol → full analysis
    pass2Done: 0,
    startedAt: null,
    finishedAt: null,
    cancelled: false,
    error: null,
  }

  const listeners = new Set()
  function emit() {
    const snapshot = { ...state, candidates: [...state.candidates], analyses: { ...state.analyses } }
    for (const cb of listeners) cb(snapshot)
  }

  function subscribe(cb) {
    listeners.add(cb)
    cb({ ...state, candidates: [...state.candidates], analyses: { ...state.analyses } })
    return () => listeners.delete(cb)
  }

  function setState(patch) {
    state = { ...state, ...patch }
    emit()
  }

  async function pass1(symbols, { concurrency = 6 } = {}) {
    // Process in parallel batches. Rate limiter in finnhub.js serialises
    // the actual network calls, but parallel kicks ahead of the queue.
    let idx = 0
    async function worker() {
      while (idx < symbols.length && !state.cancelled) {
        const i = idx++
        const sym = symbols[i]
        try {
          const quote = await getQuote(sym)
          if (state.cancelled) return
          if (quotePassesPrescreen(quote)) {
            state.candidates.push({ symbol: sym, quote })
          }
        } catch {
          state.pass1Errors++
        }
        state.pass1Done++
        if (state.pass1Done % 5 === 0 || quotePassesPrescreen) emit()
      }
    }
    const workers = Array.from({ length: concurrency }, worker)
    await Promise.all(workers)
    emit()
  }

  async function pass2({ concurrency = 4 } = {}) {
    // Sort candidates by biggest drop first — most interesting first
    const queue = [...state.candidates].sort((a, b) => (a.quote.dp ?? 0) - (b.quote.dp ?? 0))
    let idx = 0
    async function worker() {
      while (idx < queue.length && !state.cancelled) {
        const i = idx++
        const { symbol, quote } = queue[i]
        try {
          const raw = await fetchFullAnalysis(symbol, quote)
          if (state.cancelled) return
          const filterResult = runAllFilters(raw)
          const newsClassified = classifyNewsList(raw.news || [])
          state.analyses[symbol] = { ...raw, filterResult, newsClassified }
        } catch (e) {
          state.analyses[symbol] = {
            symbol,
            quote,
            error: e.message,
            filterResult: { status: 'AMBER', filters: {} },
            newsClassified: [],
          }
        }
        state.pass2Done++
        emit()
      }
    }
    const workers = Array.from({ length: concurrency }, worker)
    await Promise.all(workers)
    emit()
  }

  async function scan(symbols, { pass2: runPass2 = true } = {}) {
    if (state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'cancelled') {
      throw new Error('Scan already running')
    }
    state = {
      phase: 'pass1',
      total: symbols.length,
      pass1Done: 0,
      pass1Errors: 0,
      candidates: [],
      analyses: {},
      pass2Done: 0,
      startedAt: Date.now(),
      finishedAt: null,
      cancelled: false,
      error: null,
    }
    emit()

    try {
      await pass1(symbols)
      if (state.cancelled) {
        setState({ phase: 'cancelled', finishedAt: Date.now() })
        return
      }

      if (runPass2 && state.candidates.length > 0) {
        setState({ phase: 'pass2' })
        await pass2()
      }

      setState({
        phase: state.cancelled ? 'cancelled' : 'done',
        finishedAt: Date.now(),
      })
    } catch (e) {
      setState({ phase: 'done', error: e.message, finishedAt: Date.now() })
    }
  }

  // Re-run pass 2 on a specific candidate (e.g. after stale data refresh)
  async function refreshAnalysis(symbol, quote) {
    try {
      const raw = await fetchFullAnalysis(symbol, quote)
      const filterResult = runAllFilters(raw)
      const newsClassified = classifyNewsList(raw.news || [])
      state.analyses[symbol] = { ...raw, filterResult, newsClassified }
      emit()
      return state.analyses[symbol]
    } catch (e) {
      return null
    }
  }

  function cancel() {
    state.cancelled = true
    setState({ phase: 'cancelled' })
  }

  function reset() {
    state = {
      phase: 'idle',
      total: 0,
      pass1Done: 0,
      pass1Errors: 0,
      candidates: [],
      analyses: {},
      pass2Done: 0,
      startedAt: null,
      finishedAt: null,
      cancelled: false,
      error: null,
    }
    emit()
  }

  return { subscribe, scan, cancel, reset, refreshAnalysis, getState: () => state }
}

// Singleton scanner so the user can navigate to detail screen mid-scan
// without losing progress.
export const scanner = createScanner()

// ─── Universe expansion: fetch all US symbols ──────────────────────────────
export async function expandToFullUsUniverse() {
  const raw = await getUsSymbols()
  return filterTradeableSymbols(raw)
}

// Two-pass scanner.
//
// PASS 1 — TradingView screener (preferred):
//   Single POST returns all gap-down candidates. ~1-2 seconds, no Finnhub calls.
//   Falls back to Finnhub /quote per symbol if TV screener unavailable.
//
// PASS 2 — Finnhub full analysis (5 calls per candidate):
//   profile, metrics, news, earnings, splits → run all 10 filters.

import { getQuote, fetchFullAnalysis, getUsSymbols } from './finnhub'
import { tvPreScreen } from './tradingview'
import { runAllFilters } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { filterTradeableSymbols } from '../data/universe'

// Pre-screen thresholds — must match TradingView screener filter in tradingview.js
const PRESCREEN = {
  minDrop: -5.0,
  minPrice: 3.0,
  minVol: 50_000,
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
    phase: 'idle', // idle | tv_scan | pass1 | pass2 | done | cancelled
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
    tvMode: false, // true when pass-1 was done via TradingView screener
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

  // Pass 1A: Try TradingView screener (instant, one call)
  async function pass1TV() {
    setState({ phase: 'tv_scan' })
    const candidates = await tvPreScreen({
      minDrop: PRESCREEN.minDrop,
      minPrice: PRESCREEN.minPrice,
      minPmVol: PRESCREEN.minVol,
    })
    // Normalize to the same shape scanner.js uses internally
    state.candidates = candidates.map(({ symbol, quote, tvData }) => ({
      symbol,
      quote,
      tvData,
    }))
    state.pass1Done = candidates.length
    state.total = candidates.length
    state.tvMode = true
    emit()
  }

  // Pass 1B: Finnhub quote per symbol (fallback)
  async function pass1Finnhub(symbols, { concurrency = 6 } = {}) {
    setState({ phase: 'pass1', total: symbols.length })
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
        if (state.pass1Done % 5 === 0) emit()
      }
    }
    const workers = Array.from({ length: concurrency }, worker)
    await Promise.all(workers)
    emit()
  }

  async function pass2({ concurrency = 4 } = {}) {
    const queue = [...state.candidates].sort((a, b) => (a.quote?.dp ?? 0) - (b.quote?.dp ?? 0))
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

  async function scan(symbols, { pass2: runPass2 = true, forceFinnhub = false } = {}) {
    if (state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'cancelled') {
      throw new Error('Scan already running')
    }
    state = {
      phase: 'tv_scan',
      total: 0,
      pass1Done: 0,
      pass1Errors: 0,
      candidates: [],
      analyses: {},
      pass2Done: 0,
      startedAt: Date.now(),
      finishedAt: null,
      cancelled: false,
      error: null,
      tvMode: false,
    }
    emit()

    try {
      // Try TradingView screener first (instant scan, no Finnhub quota used)
      if (!forceFinnhub) {
        try {
          await pass1TV()
        } catch (tvErr) {
          // TV screener failed → fall back to Finnhub pass 1
          console.warn('TV screener unavailable, falling back to Finnhub:', tvErr.message)
          state.candidates = []
          state.tvMode = false
          await pass1Finnhub(symbols)
        }
      } else {
        state.tvMode = false
        await pass1Finnhub(symbols)
      }

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

  async function refreshAnalysis(symbol, quote) {
    try {
      const raw = await fetchFullAnalysis(symbol, quote)
      const filterResult = runAllFilters(raw)
      const newsClassified = classifyNewsList(raw.news || [])
      state.analyses[symbol] = { ...raw, filterResult, newsClassified }
      emit()
      return state.analyses[symbol]
    } catch {
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
      tvMode: false,
    }
    emit()
  }

  return { subscribe, scan, cancel, reset, refreshAnalysis, getState: () => state }
}

export const scanner = createScanner()

export async function expandToFullUsUniverse() {
  const raw = await getUsSymbols()
  return filterTradeableSymbols(raw)
}

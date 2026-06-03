// Two-pass scanner.
//
// PASS 1 — TradingView screener (preferred, no Finnhub calls):
//   Single POST returns candidates for the chosen strategy mode.
//   Falls back to Finnhub /quote per symbol if TV screener unavailable.
//
// PASS 2 — TV mode: 2 Finnhub calls per candidate (news + splits).
//          Finnhub fallback: 5 calls per candidate (full analysis).
//   Earnings calendar fetched once and shared across all candidates.

import { getQuote, fetchFullAnalysis, fetchLightAnalysis, getEarnings, getUsSymbols } from './finnhub'
import { tvPreScreen } from './tradingview'
import { runAllFilters, STRATEGY_CONFIG } from '../utils/filters'
import { classifyNewsList } from '../utils/newsClassifier'
import { filterTradeableSymbols } from '../data/universe'
import { alertGreenStock } from './notify'

// Build Finnhub-compatible profile/metrics objects from TV screener data.
// Used both for immediate preliminary results and as the base for light analysis.
function tvDataToAnalysis(symbol, quote, tvData, mode, preliminary = false) {
  const profile = {
    marketCapitalization: tvData?.marketCap != null ? tvData.marketCap / 1_000_000 : null,
    finnhubIndustry: tvData?.sector || '',
    exchange: tvData?.exchange || '',
    name: tvData?.name || symbol,
  }
  const metrics = {
    metric: {
      peBasicExclExtraTTM: tvData?.pe ?? null,
      peTTM: tvData?.pe ?? null,
      '10DayAverageTradingVolume': tvData?.avgVol10d != null ? tvData.avgVol10d / 1_000_000 : null,
    },
  }
  const raw = { symbol, quote, profile, metrics, news: [], earnings: null, splits: [], tvData }
  const filterResult = runAllFilters(raw, mode)
  return { ...raw, filterResult, newsClassified: [], mode, preliminary }
}

function quotePassesPrescreen(quote, mode = 'gap_down') {
  if (!quote) return false
  const cfg = STRATEGY_CONFIG[mode] ?? STRATEGY_CONFIG.gap_down
  const { dp, c, v } = quote
  if (dp == null || c == null) return false
  if (cfg.minGain !== null) {
    if (dp < cfg.minGain) return false
  } else {
    if (dp > cfg.minDrop) return false
    if (cfg.maxDrop !== null && dp < cfg.maxDrop) return false
  }
  if (c < cfg.minPrice) return false
  if (v != null && v < cfg.minPmVol * 0.8) return false
  return true
}

export function createScanner() {
  let state = {
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
    mode: 'gap_down',
  }

  const listeners = new Set()
  function emit() {
    const snap = { ...state, candidates: [...state.candidates], analyses: { ...state.analyses } }
    for (const cb of listeners) cb(snap)
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

  async function pass1TV(mode, universeSymbols) {
    setState({ phase: 'tv_scan' })
    let candidates = await tvPreScreen(mode)

    // If a specific universe is selected (not full US), post-filter to that universe.
    // universeSymbols < 5000 distinguishes curated/tech/etc. from the full US list.
    if (universeSymbols && universeSymbols.length > 0 && universeSymbols.length < 5000) {
      const set = new Set(universeSymbols)
      candidates = candidates.filter(c => set.has(c.symbol))
    }

    state.candidates = candidates.map(({ symbol, quote, tvData }) => ({ symbol, quote, tvData }))
    state.pass1Done = candidates.length
    state.total = candidates.length
    state.tvMode = true

    // Show preliminary results immediately using TV data — list appears in ~2s.
    // Pass-2 will overwrite each entry with full news/splits enrichment.
    for (const { symbol, quote, tvData } of state.candidates) {
      state.analyses[symbol] = tvDataToAnalysis(symbol, quote, tvData, mode, true)
    }
    emit()
  }

  async function pass1Finnhub(symbols, mode, { concurrency = 6 } = {}) {
    setState({ phase: 'pass1', total: symbols.length })
    let idx = 0
    async function worker() {
      while (idx < symbols.length && !state.cancelled) {
        const i = idx++
        const sym = symbols[i]
        try {
          const quote = await getQuote(sym)
          if (state.cancelled) return
          if (quotePassesPrescreen(quote, mode)) {
            state.candidates.push({ symbol: sym, quote })
          }
        } catch {
          state.pass1Errors++
        }
        state.pass1Done++
        if (state.pass1Done % 5 === 0) emit()
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    emit()
  }

  async function pass2(mode, { concurrency = 8, maxCandidates = 200 } = {}) {
    const isUp = mode === 'gap_up'

    // TV mode: fetch earnings once (1 call total) shared across all candidates.
    const todayStr = new Date().toISOString().slice(0, 10)
    let sharedEarnings = null
    if (state.tvMode) {
      try { sharedEarnings = await getEarnings(todayStr, todayStr) } catch {}
    }

    const queue = [...state.candidates]
      .sort((a, b) =>
        isUp
          ? (b.quote?.dp ?? 0) - (a.quote?.dp ?? 0)
          : (a.quote?.dp ?? 0) - (b.quote?.dp ?? 0)
      )
      .slice(0, maxCandidates)
    let idx = 0
    async function worker() {
      while (idx < queue.length && !state.cancelled) {
        const i = idx++
        const { symbol, quote, tvData } = queue[i]
        try {
          let raw
          if (tvData) {
            // TV mode: 2 Finnhub calls (news + splits). Profile/metrics from tvData.
            raw = await fetchLightAnalysis(symbol, quote, tvData, sharedEarnings)
          } else {
            // Finnhub fallback: 5 calls per stock
            raw = await fetchFullAnalysis(symbol, quote)
          }
          if (state.cancelled) return
          const filterResult = runAllFilters(raw, mode)
          const newsClassified = classifyNewsList(raw.news || [])
          state.analyses[symbol] = { ...raw, tvData, filterResult, newsClassified, mode, preliminary: false }
          if (filterResult.status === 'GREEN') {
            alertGreenStock(symbol, quote?.dp, null).catch(() => {})
          }
        } catch (e) {
          // Finnhub failed: keep the TV-only preliminary result rather than showing an error.
          // The stock is still visible with F1-F7 filter results from TV data.
          if (tvData && state.analyses[symbol]?.preliminary) {
            state.analyses[symbol] = {
              ...state.analyses[symbol],
              preliminary: false,
              fetchError: e.message,
            }
          } else {
            state.analyses[symbol] = {
              symbol, quote, tvData,
              error: e.message,
              filterResult: { status: 'AMBER', filters: {}, score: 0, mode },
              newsClassified: [],
              mode,
            }
          }
        }
        state.pass2Done++
        emit()
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    emit()
  }

  async function scan(symbols, { pass2: runPass2 = true, forceFinnhub = false, mode = 'gap_down' } = {}) {
    if (state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'cancelled') {
      throw new Error('Scan already running')
    }
    state = {
      phase: 'tv_scan', total: 0, pass1Done: 0, pass1Errors: 0,
      candidates: [], analyses: {}, pass2Done: 0,
      startedAt: Date.now(), finishedAt: null,
      cancelled: false, error: null, tvMode: false, mode,
    }
    emit()

    try {
      if (!forceFinnhub) {
        try {
          await pass1TV(mode, symbols)
        } catch (tvErr) {
          console.warn('TV screener unavailable, falling back to Finnhub:', tvErr.message)
          state.candidates = []
          state.tvMode = false
          await pass1Finnhub(symbols, mode)
        }
      } else {
        state.tvMode = false
        await pass1Finnhub(symbols, mode)
      }

      if (state.cancelled) {
        setState({ phase: 'cancelled', finishedAt: Date.now() })
        return
      }

      if (runPass2 && state.candidates.length > 0) {
        setState({ phase: 'pass2' })
        await pass2(mode)
      }

      setState({ phase: state.cancelled ? 'cancelled' : 'done', finishedAt: Date.now() })
    } catch (e) {
      setState({ phase: 'done', error: e.message, finishedAt: Date.now() })
    }
  }

  async function refreshAnalysis(symbol, quote, mode = 'gap_down') {
    try {
      const raw = await fetchFullAnalysis(symbol, quote)
      const filterResult = runAllFilters(raw, mode)
      const newsClassified = classifyNewsList(raw.news || [])
      state.analyses[symbol] = { ...raw, filterResult, newsClassified, mode }
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
      phase: 'idle', total: 0, pass1Done: 0, pass1Errors: 0,
      candidates: [], analyses: {}, pass2Done: 0,
      startedAt: null, finishedAt: null, cancelled: false, error: null, tvMode: false, mode: 'gap_down',
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

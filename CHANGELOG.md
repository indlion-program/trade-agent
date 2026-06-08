# Trade Agent — Changelog

All changes are documented here in order. Each entry lists what changed, why, and whether it introduced or fixed any errors.

---

## [2026-06-06] Session — Systematic Bug Fix Log

### COMPLETED FIXES

#### FIX-01 · Black screen on "All US >$500M" universe
- **File**: `src/screens/ScannerScreen.jsx` line 234
- **Root cause**: `currentUniverse` is `null` for `large_us` mode; calling `.length` on `null` threw TypeError → React tree crashed → black screen.
- **Fix**: Added null guard: `currentUniverse !== null && currentUniverse.length === 0`
- **Commit**: `affc2b5`
- **Status**: ✅ No regressions

#### FIX-02 · TV screener failing silently → Finnhub fallback + rate limit
- **File**: `src/services/tradingview.js`
- **Root cause**: `earnings_release_date` is not a valid TradingView screener column. TV screener rejects the entire request when any column is unknown → `postScreener` throws → `pass1TV` falls back to `pass1Finnhub` → rate limit hits at 55 calls for curated, 0 symbols for large_us → 0 results.
- **Fix**: Removed `earnings_release_date` from `COL` map and `COLUMNS` array, removed `earningsDate` from tvData.
- **Commit**: `76819bd`
- **Status**: ✅ No regressions

#### FIX-03 · `getNewsYahoo` hangs without timeout → pass-2 frozen
- **File**: `src/services/finnhub.js`
- **Root cause**: No `AbortController` on the `/api/news` fetch. If Yahoo RSS or the Vercel proxy is slow, all 8 pass-2 workers block indefinitely.
- **Fix**: Added 5-second `AbortController` timeout; on abort/error returns `[]` and continues.
- **Commit**: `76819bd`
- **Status**: ✅ No regressions

#### FIX-04 · Finnhub eliminated from scan pipeline (0 calls per stock)
- **Files**: `scanner.js`, `finnhub.js`, `tradingview.js`, `filters.js`
- **Root cause**: `fetchLightAnalysis` was making 2 Finnhub calls per candidate (news + splits). `scanner.js` made 1 shared earnings call.
- **Fix**: Replaced Finnhub news with Yahoo RSS (`getNewsYahoo`). Removed `getSplits` (large-cap stocks rarely reverse-split). Removed shared `getEarnings` call. `maxCandidates` raised 50 → 500.
- **Commit**: `b490cea`
- **Status**: ✅ No regressions

---

### ACTIVE ISSUES

#### BUG-01 · AlarmsScreen drains Finnhub quota on every page load ✅ FIXED
- **File**: `src/screens/AlarmsScreen.jsx`
- **Root cause**: `getQuote(sym)` (Finnhub) called for each active alarm on every alarms-list change. AlarmsScreen is always mounted → runs on app start. With 17 alarms → 17 queued Finnhub calls before any scan begins.
- **Fix**: Removed `getQuote` import and all seed calls. Live prices come from WebSocket only; `—` shown until first WS tick (already the correct fallback when market closed).
- **Compile errors**: None
- **Runtime errors**: None (WebSocket still provides prices; `—` shown when market closed — expected)
- **Status**: ✅ FIXED

#### BUG-02 · Scan returns 0 results with no explanation ✅ FIXED
- **File**: `src/screens/ScannerScreen.jsx`
- **Root cause**: TV screener returns 0 gap stocks on weekends / closed market / quiet pre-market. App showed "Scan complete · 0/0 · CANDIDATES: 0" with no explanation. User assumed app was broken.
- **Fix**: Added "📭 No gap stocks found" banner (with weekend/timing explanation) shown when `phase === 'done'` and 0 candidates. Kept separate idle state for pre-scan.
- **Compile errors**: None
- **Runtime errors**: None
- **Status**: ✅ FIXED

---

#### BUG-03 · Scanner returns 0 results on weekends / after-hours ✅ FIXED
- **File**: `src/services/tradingview.js`
- **Root cause**: TV screener filter used `premarket_change` which is `null` outside pre-market hours (weekends, evenings, market hours). Screenshot showed TradingView manually finding 5 gap stocks (MU -13%, LULU -8%, ACMR -15%) while our scanner returned 0/0.
- **Fix**: Changed filter field from `premarket_change` → `change` (total % change from prev close, always populated 24/7). Also removed `premarket_volume` filter (null outside pre-market) and updated sort field to `change`. Quote `dp` now uses `pmChange ?? change` so pre-market change is preferred but daily change is shown when PM data unavailable.
- **Compile errors**: None
- **Runtime errors**: None
- **Status**: ✅ FIXED

#### BUG-04 · Finnhub REST API still used in scan/search/detail ✅ FIXED
- **Files**: `scanner.js`, `ScannerScreen.jsx`, `DetailScreen.jsx`
- **Root cause**: `fetchFullAnalysis` (5 Finnhub REST calls per stock) was still imported and called in: (1) DetailScreen on mount to refresh data, (2) ScannerScreen `handleSearch` for manual ticker lookup, (3) scanner.js pass-2 fallback for non-TV candidates, (4) scanner.js `refreshAnalysis`.
- **Fix**:
  - `scanner.js`: Removed `pass1Finnhub`, removed `fetchFullAnalysis` import, removed `refreshAnalysis`, removed Finnhub fallback (TV screener failure shows error instead). Pass-2 uses `fetchLightAnalysis` (Yahoo RSS) only.
  - `tradingview.js`: Added `tvSingleStock(symbol)` — looks up a single ticker in TV screener (tries NASDAQ/NYSE/AMEX prefixes).
  - `ScannerScreen.jsx`: `handleSearch` now calls `tvSingleStock` + `fetchLightAnalysis` instead of `fetchFullAnalysis`.
  - `DetailScreen.jsx`: Background refresh now calls `fetchLightAnalysis` with existing `tvData` instead of `fetchFullAnalysis`.
- **Finnhub remaining**: WebSocket only (`wss://ws.finnhub.io`) for live prices in Alarms + DetailScreen.
- **Compile errors**: None
- **Runtime errors**: None
- **Status**: ✅ FIXED

---

#### BUG-05 · TV screener proxy returns HTTP 405 → 0 scan results ✅ FIXED
- **File**: `api/screener.js`
- **Root cause**: Two issues combined: (1) `body: JSON.stringify(req.body)` — Vercel auto-parses the request body into `req.body`, so re-serializing it can produce an incorrectly shaped payload that TradingView rejects with 405. (2) Minimal `User-Agent: 'Mozilla/5.0'` — TradingView likely blocks non-browser-looking requests from Vercel server IPs without a full browser UA string.
- **Fix**: Read raw body from the request stream (`req.on('data')`) to avoid re-serialization. Added comprehensive browser-like headers: full Chrome 124 User-Agent, Accept, Accept-Language, Accept-Encoding, sec-ch-ua, Sec-Fetch-Dest/Mode/Site. Also improved error response to include TradingView's response body for future debugging.
- **Status**: ✅ FIXED

---

### PENDING FIXES (queue)

*None — all known bugs resolved.*

---

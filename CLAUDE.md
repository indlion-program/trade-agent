# Gap-Reversal Trading Scanner — Claude Code Guide

## What this app does

Mobile-first React app for pre-market gap-fill reversal day trading. Every morning before market open (4 AM–9:30 AM ET), scan thousands of US stocks for ones that dropped ≥5% pre-market on emotional overreaction — then trade the bounce back to the gap fill.

**Strategy thesis:** Fundamentally healthy stocks that drop hard on macro news / sector rotation / analyst downgrades (not actual fundamental damage) tend to fill the gap by end of day.

## How to run locally (Windows)

```cmd
cd C:\Users\lagol\trade-agent
git pull origin main
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome.

**Finnhub API key** — create `.env.local` in project root:
```
VITE_FINNHUB_KEY=your_key_here
```
**NEVER commit this file.** It is already in `.gitignore`.

## Architecture

```
src/
  services/
    tradingview.js   ← NEW: instant scan via TradingView screener (no API key!)
    finnhub.js       ← quote, profile, metrics, news, earnings, splits
    scanner.js       ← two-pass scanner with TV screener for pass 1
    websocket.js     ← Finnhub WebSocket for live price ticks
    cache.js         ← IndexedDB (persistent) + in-memory L1 cache
  utils/
    filters.js       ← all 10 entry filters
    fibonacci.js     ← Fibonacci level calculator
    newsClassifier.js← AVOID / OPPORTUNITY / NEUTRAL keyword classifier
    marketTime.js    ← DST-aware ET clock
  hooks/
    useScanner.js    ← wraps scanner singleton
    useLivePrice.js  ← WebSocket price subscription
    useMarketClock.js← ET time, updates every 1s
    usePullToRefresh.js
  components/        ← pure UI components
  screens/
    ScannerScreen.jsx← main scanner list
    DetailScreen.jsx ← per-stock detail (Fibonacci, filters, news)
  data/
    universe.js      ← curated ~750 symbols + UNIVERSE_GROUPS
api/
  screener.js        ← Vercel edge proxy for TradingView screener (CORS)
```

## The 10 entry filters

| # | Filter | Threshold |
|---|--------|-----------|
| 1 | Pre-market drop | ≤ −5% |
| 2 | Price | > $3.00 |
| 3 | Avg daily volume | ≥ 750K |
| 4 | Pre-market volume | ≥ 50K |
| 5 | P/E TTM | > 0 (profitable) |
| 6 | Market cap | ≥ $500M |
| 7 | No reverse split | Last 12 months |
| 8 | Not earnings day | Skip earnings |
| 9 | Entry timing | First green 1-min candle after 9:30 AM |
| 10 | AmericanBulls | Not SELL / STRONG SELL |

**GREEN** = all pass. **AMBER** = manual checks needed. **RED** = hard fail or AVOID news.

**News AVOID override:** If any headline contains fraud/SEC/bankruptcy/restatement/delisting/lawsuit keywords → stock becomes RED regardless of filters.

## Data sources

### TradingView Screener (PRIMARY — free, no key)
- Endpoint: `POST https://scanner.tradingview.com/america/scan`
- Returns all gap-down stocks matching filter criteria in ONE request
- Fields: `premarket_change`, `premarket_close`, `premarket_high`, `premarket_low`, `premarket_volume`, `market_cap_basic`, `average_volume_10d_calc`, `sector`, `name` (description)
- Called via `/api/screener` Vercel proxy to handle CORS
- Replaces Finnhub pass-1 entirely — scan 5000+ symbols in <2 seconds

### Finnhub REST API (SECONDARY — free tier, needs key)
- Rate limit: 60 calls/min → capped at 55/min (sliding window)
- Used for: detailed P/E metrics, company profile, news, earnings calendar, stock splits
- Pass-2 uses 5 calls/symbol → only for candidates (post TV screener filter)
- Cache TTLs: quote 1min, profile 7d, metrics 1d, news 5min, splits 30d

### Finnhub WebSocket (LIVE PRICES)
- `wss://ws.finnhub.io?token=KEY`
- Used on DetailScreen for real-time price ticks
- Auto-reconnects on disconnect

## Two-pass scanner flow (updated)

```
Pass 1: TradingView screener (1 API call, ~1-2 seconds)
  → Filters: premarket_change ≤ -5%, close > $3, premarket_volume ≥ 50K
  → Returns all candidates at once (no Finnhub calls used)
  → Falls back to Finnhub quote-per-symbol if TV screener unavailable

Pass 2: Finnhub full analysis (5 calls per candidate)
  → Profile, metrics, news, earnings, splits
  → Runs all 10 filters
  → Rate-limited at 55/min via sliding window
```

## Fibonacci levels

Calculated from **pre-market high/low** range:

| Level | Role | Use |
|-------|------|-----|
| 0.0 | PM Low | Stop loss zone |
| 0.236 | Early resistance | — |
| **0.382** | **Entry zone** | **Enter here** |
| 0.5 | Mid target | T1 |
| **0.618** | **Main target** | **T2 (primary target)** |
| 0.786 | Stretch target | T3 |
| 1.0 | PM High | Full gap fill |

Stop loss = PM Low × 0.985 (−1.5% below PM low)
R/R gate = reward (T2 − entry) / risk (entry − stop) ≥ 2.0

**Data source priority:** `/stock/candle` (paid tier, usually fails) → `/quote` h/l fallback → no data

## Caching strategy

Two-layer cache in `src/services/cache.js`:
1. **L1 in-memory** — Map with TTL, reset on page reload
2. **L2 IndexedDB** — survives page reload, TTL-checked on read

Cache keys: `quote:AAPL`, `profile:AAPL`, `metrics:AAPL`, etc.

## Universe sizes

| Group | Size |
|-------|------|
| Watchlist | 20 mega-caps |
| Curated | ~750 stocks + ETFs |
| Large Caps | ~500 S&P 500 |
| Tech | ~150 |
| Speculative | ~100 EV/meme/crypto |
| ETFs Only | ~80 |
| Full US | ~5000 (fetched on-demand, cached 7d) |

## Key files to edit for common tasks

**Add a new filter:** `src/utils/filters.js` + `runAllFilters()` + `src/components/FilterList.jsx`

**Change scanner pre-screen thresholds:** `src/services/scanner.js` top constants, OR `src/services/tradingview.js` request body

**Add a new universe group:** `src/data/universe.js` → UNIVERSE_GROUPS + `src/components/UniverseSelector.jsx` PRESETS

**Update Fibonacci entry/target ratios:** `src/utils/fibonacci.js` LEVELS/ROLES constants

**Change news AVOID keywords:** `src/utils/newsClassifier.js` AVOID_KEYWORDS array

## Deployment (Vercel)

```bash
# From repo root
vercel --prod
```

Or push to `main` branch — auto-deploys via Vercel GitHub integration.

`vercel.json` handles:
- Build: `npm run build`
- API routes: `api/*.js` → Vercel serverless functions
- SPA fallback: all non-API routes → `index.html`

## Current limitations / known issues

1. **Finnhub free tier `/stock/candle` is paid** — Fibonacci always falls back to quote h/l range, which is intraday range during market hours (not pure pre-market). Acceptable approximation.

2. **Pre-market volume on Finnhub** — `/quote?v` field is total day volume, not pure pre-market. TradingView screener provides real `premarket_volume`.

3. **AmericanBulls filter (F10)** — manual check only. App opens the link, user checks the checkbox. No automated integration possible (no public API).

4. **Filter 9 (entry timing)** — always shows as pending (null). This is correct — it's a rule the trader enforces manually. The 9:30 AM first-green-candle rule cannot be automated in a pre-market scanner.

5. **Earnings calendar** — Finnhub free tier only returns earnings for the current day. That's fine for our use case.

## Git workflow

- Feature branches: `claude/<name>`
- All work goes to feature branch, PR to `main`
- **Never commit `.env.local`** (Finnhub API key)
- **Never commit `.env.local`** I mean it

## Planned improvements (do these next)

- [ ] TradingView chart embed in DetailScreen (TradingView widget iframe)
- [ ] Per-stock notes (localStorage, pre-trade journal)
- [ ] Alert when scan finds GREEN stocks (Notification API)
- [ ] Export trade plan as image (for screenshot)
- [ ] Historical scan replay (review yesterday's gap-downs)

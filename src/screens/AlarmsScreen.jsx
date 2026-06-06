import { useState, useEffect, useRef } from 'react'
import { Header } from '../components/Header'
import { getAlarms, addAlarm, removeAlarm, markTriggered, clearTriggered } from '../services/alarms'
import { alertPriceAlarm } from '../services/notify'
import { subscribeTicker } from '../services/websocket'

export function AlarmsScreen() {
  const [alarms, setAlarms] = useState(getAlarms)
  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState('below')
  const [targetPrice, setTargetPrice] = useState('')
  const [livePrices, setLivePrices] = useState({})
  const subsRef = useRef({})
  const firedRef = useRef(new Set()) // alarm ids already fired this session

  function reload() { setAlarms(getAlarms()) }

  useEffect(() => {
    window.addEventListener('alarmsChange', reload)
    return () => window.removeEventListener('alarmsChange', reload)
  }, [])

  // Sync WebSocket subscriptions whenever alarms list changes
  useEffect(() => {
    const needed = [...new Set(alarms.filter(a => !a.triggered).map(a => a.symbol))]

    // Unsubscribe from symbols no longer needed
    for (const sym of Object.keys(subsRef.current)) {
      if (!needed.includes(sym)) {
        subsRef.current[sym]?.()
        delete subsRef.current[sym]
      }
    }

    // Subscribe to new symbols
    for (const sym of needed) {
      if (!subsRef.current[sym]) {
        subsRef.current[sym] = subscribeTicker(sym, (price) => {
          setLivePrices(prev => ({ ...prev, [sym]: price }))
          checkCrossings(sym, price)
        })
      }
    }

    return () => {
      for (const unsub of Object.values(subsRef.current)) unsub?.()
      subsRef.current = {}
    }
  }, [alarms])

  function checkCrossings(sym, price) {
    for (const alarm of getAlarms()) {
      if (alarm.symbol !== sym || alarm.triggered || firedRef.current.has(alarm.id)) continue
      const hit = alarm.direction === 'above' ? price >= alarm.targetPrice : price <= alarm.targetPrice
      if (hit) {
        firedRef.current.add(alarm.id)
        markTriggered(alarm.id)
        alertPriceAlarm(sym, alarm.direction, alarm.targetPrice, price).catch(() => {})
      }
    }
  }

  function handleAdd(e) {
    e.preventDefault()
    const sym = symbol.trim().toUpperCase()
    const price = parseFloat(targetPrice)
    if (!sym || isNaN(price) || price <= 0) return
    addAlarm(sym, direction, price)
    setSymbol('')
    setTargetPrice('')
  }

  const active = alarms.filter(a => !a.triggered)
  const triggered = alarms.filter(a => a.triggered)

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      <Header title="Price Alarms" subtitle="Notify when price crosses your target" />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Add alarm form */}
        <form
          onSubmit={handleAdd}
          className="rounded-xl border p-4 space-y-3"
          style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
        >
          <div className="text-xs font-bold" style={{ color: '#f1f5f9', letterSpacing: '0.06em' }}>
            NEW ALARM
          </div>

          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="Ticker symbol  (e.g. AAPL, TSLA)"
            className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
            style={{ background: '#111', borderColor: '#2a2a2a', color: '#f1f5f9' }}
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="flex gap-2">
            {/* Direction toggle */}
            <div className="flex rounded-lg overflow-hidden border shrink-0" style={{ borderColor: '#2a2a2a' }}>
              {['below', 'above'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className="px-3 py-2.5 text-xs font-bold"
                  style={{
                    background: direction === d
                      ? (d === 'above' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)')
                      : '#111',
                    color: direction === d
                      ? (d === 'above' ? '#22c55e' : '#ef4444')
                      : '#475569',
                  }}
                >
                  {d === 'above' ? '↑ Above' : '↓ Below'}
                </button>
              ))}
            </div>

            {/* Price */}
            <input
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              placeholder="Price  e.g. 150.00"
              type="number"
              step="0.01"
              min="0.01"
              className="flex-1 rounded-lg px-3 py-2.5 text-sm border outline-none"
              style={{ background: '#111', borderColor: '#2a2a2a', color: '#f1f5f9' }}
            />
          </div>

          <button
            type="submit"
            disabled={!symbol.trim() || !targetPrice || parseFloat(targetPrice) <= 0}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: '#22c55e', color: '#0f0f0f' }}
          >
            Set Alarm
          </button>
        </form>

        {/* Active alarms */}
        {active.length > 0 && (
          <div>
            <div className="text-xs font-bold mb-2" style={{ color: '#64748b', letterSpacing: '0.06em' }}>
              ACTIVE — {active.length} alarm{active.length !== 1 ? 's' : ''}
            </div>
            <div className="space-y-2">
              {active.map(a => (
                <AlarmRow
                  key={a.id}
                  alarm={a}
                  livePrice={livePrices[a.symbol]}
                  onDelete={() => removeAlarm(a.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Triggered */}
        {triggered.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold" style={{ color: '#64748b', letterSpacing: '0.06em' }}>
                TRIGGERED — {triggered.length}
              </div>
              <button onClick={clearTriggered} className="text-xs font-semibold" style={{ color: '#ef4444' }}>
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {triggered.map(a => (
                <AlarmRow
                  key={a.id}
                  alarm={a}
                  livePrice={livePrices[a.symbol]}
                  onDelete={() => removeAlarm(a.id)}
                  triggered
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {alarms.length === 0 && (
          <div className="text-center py-16">
            <div style={{ fontSize: '40px' }}>🔔</div>
            <div className="mt-3 text-sm font-semibold" style={{ color: '#64748b' }}>No alarms set</div>
            <div className="text-xs mt-1" style={{ color: '#334155' }}>
              Add a ticker and price target above
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AlarmRow({ alarm, livePrice, onDelete, triggered = false }) {
  const isAbove = alarm.direction === 'above'
  const priceDiff = livePrice != null ? livePrice - alarm.targetPrice : null
  const pctAway = priceDiff != null ? (priceDiff / alarm.targetPrice) * 100 : null
  const isClose = pctAway != null && Math.abs(pctAway) < 2

  return (
    <div
      className="rounded-xl border px-4 py-3 flex items-center gap-3"
      style={{
        background: triggered ? '#111' : '#1a1a1a',
        borderColor: triggered ? '#1e1e1e' : isClose && !triggered ? 'rgba(245,158,11,0.3)' : '#2a2a2a',
        opacity: triggered ? 0.55 : 1,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm" style={{ color: triggered ? '#475569' : '#f1f5f9' }}>
            {alarm.symbol}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{
              background: isAbove ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isAbove ? '#22c55e' : '#ef4444',
            }}
          >
            {isAbove ? '↑ Above' : '↓ Below'} ${alarm.targetPrice.toFixed(2)}
          </span>
          {triggered && (
            <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>✓ Hit</span>
          )}
          {isClose && !triggered && (
            <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>● Near</span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs font-mono tabular-nums" style={{ color: '#94a3b8' }}>
            {livePrice != null ? `$${livePrice.toFixed(2)}` : '—'}
          </span>
          {pctAway != null && !triggered && (
            <span className="text-xs font-mono" style={{ color: isClose ? '#f59e0b' : '#475569' }}>
              {pctAway > 0 ? '+' : ''}{pctAway.toFixed(1)}% away
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="p-2 rounded-lg shrink-0"
        style={{ background: '#222', color: '#64748b' }}
        aria-label="Delete alarm"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-7"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

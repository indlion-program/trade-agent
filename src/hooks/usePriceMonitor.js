import { useEffect, useRef, useState } from 'react'
import { subscribeTicker } from '../services/websocket'
import { getPortfolio, sellPartial, sellAll } from '../services/paper'
import { sendTradeAlert } from '../services/notify'

// Watches all open positions via WebSocket and auto-executes Fibonacci targets/stop.
// Returns live price map: { AAPL: 312.50, ... }
export function usePriceMonitor() {
  const [livePrices, setLivePrices] = useState({})
  const subsRef = useRef({}) // symbol → unsubscribe fn

  function handlePrice(symbol, price) {
    setLivePrices(prev => ({ ...prev, [symbol]: price }))
    checkThresholds(symbol, price)
  }

  function checkThresholds(symbol, price) {
    const { positions, notifyTopic } = getPortfolio()
    const openForSymbol = positions.filter(p => p.symbol === symbol)

    for (const pos of openForSymbol) {
      const isUp = pos.mode === 'gap_up'

      // Stop loss hit
      if (price <= pos.stopLoss && pos.stopLoss) {
        sellAll(pos.id, price, 'stop')
        sendTradeAlert({
          title: `🚨 STOP HIT — ${symbol}`,
          body: `Stop loss triggered at $${price.toFixed(2)}. Position closed.`,
          type: 'stop',
          topic: notifyTopic,
        })
        return
      }

      // Target 1
      const t1Hit = pos.hitTargets.includes('target1')
      if (!t1Hit && pos.target1) {
        const t1Reached = isUp ? price >= pos.target1 : price >= pos.target1
        if (t1Reached) {
          sellPartial(pos.id, price, 'target1')
          sendTradeAlert({
            title: `🎯 TARGET 1 — ${symbol}`,
            body: `First target hit at $${price.toFixed(2)}. Sold 50% of position.`,
            type: 'target',
            topic: notifyTopic,
          })
        }
      }

      // Target 2
      const t2Hit = pos.hitTargets.includes('target2')
      if (!t2Hit && pos.target2) {
        const t2Reached = isUp ? price >= pos.target2 : price >= pos.target2
        if (t2Reached) {
          sellAll(pos.id, price, 'target2')
          sendTradeAlert({
            title: `🏆 TARGET 2 HIT — ${symbol}`,
            body: `Main target hit at $${price.toFixed(2)}. Position fully closed.`,
            type: 'target',
            topic: notifyTopic,
          })
        }
      }
    }
  }

  function syncSubscriptions() {
    const { positions } = getPortfolio()
    const needed = new Set(positions.map(p => p.symbol))

    // Unsubscribe from symbols no longer in positions
    for (const sym of Object.keys(subsRef.current)) {
      if (!needed.has(sym)) {
        subsRef.current[sym]?.()
        delete subsRef.current[sym]
      }
    }

    // Subscribe to new symbols
    for (const sym of needed) {
      if (!subsRef.current[sym]) {
        subsRef.current[sym] = subscribeTicker(sym, (price) => handlePrice(sym, price))
      }
    }
  }

  useEffect(() => {
    syncSubscriptions()

    function onPortfolioChange() { syncSubscriptions() }
    window.addEventListener('portfolioChange', onPortfolioChange)

    return () => {
      window.removeEventListener('portfolioChange', onPortfolioChange)
      for (const unsub of Object.values(subsRef.current)) unsub?.()
      subsRef.current = {}
    }
  }, [])

  return livePrices
}

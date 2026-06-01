import { useState, useEffect } from 'react'
import { getPortfolio, calcEquity } from '../services/paper'

// React hook — re-renders whenever portfolio changes (buy, sell, settings update)
export function usePaperPortfolio(livePrices = {}) {
  const [portfolio, setPortfolio] = useState(() => getPortfolio())
  const [equity, setEquity]       = useState(() => calcEquity(livePrices))

  function refresh() {
    const p = getPortfolio()
    setPortfolio(p)
    setEquity(calcEquity(livePrices))
  }

  useEffect(() => {
    window.addEventListener('portfolioChange', refresh)
    return () => window.removeEventListener('portfolioChange', refresh)
  }, [])

  // Re-calc equity when live prices change
  useEffect(() => {
    setEquity(calcEquity(livePrices))
  }, [JSON.stringify(livePrices)])

  return { portfolio, equity, refresh }
}

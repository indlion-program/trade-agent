import { useState, useEffect } from 'react'
import { getMarketStatus, formatEtTime, formatEtDate } from '../utils/marketTime'

export function useMarketClock() {
  const [state, setState] = useState(() => ({
    time: formatEtTime(),
    date: formatEtDate(),
    status: getMarketStatus(),
  }))

  useEffect(() => {
    const tick = () => {
      setState({
        time: formatEtTime(),
        date: formatEtDate(),
        status: getMarketStatus(),
      })
    }
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return state
}

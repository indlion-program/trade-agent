import { useState, useEffect, useRef } from 'react'
import { subscribeTicker } from '../services/websocket'

export function useLivePrice(symbol, initialPrice = null) {
  const [price, setPrice] = useState(initialPrice)
  const [change, setChange] = useState(null) // 'up' | 'down' | null
  const [wsStatus, setWsStatus] = useState('connecting')
  const prevPrice = useRef(initialPrice)
  const flashTimer = useRef(null)

  useEffect(() => {
    if (!symbol) return
    setWsStatus('connecting')

    const unsub = subscribeTicker(symbol, (p) => {
      setWsStatus('connected')
      setPrice(prev => {
        if (prev !== null && p !== prev) {
          clearTimeout(flashTimer.current)
          setChange(p > prev ? 'up' : 'down')
          flashTimer.current = setTimeout(() => setChange(null), 600)
        }
        prevPrice.current = p
        return p
      })
    })

    return () => {
      unsub()
      clearTimeout(flashTimer.current)
    }
  }, [symbol])

  return { price: price ?? initialPrice, change, wsStatus }
}

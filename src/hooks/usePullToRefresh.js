import { useState, useEffect, useRef } from 'react'

export function usePullToRefresh(onRefresh, threshold = 80) {
  const [pulling, setPulling] = useState(false)
  const [pullY, setPullY] = useState(0)
  const startY = useRef(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current || window

    function onTouchStart(e) {
      const scrollTop = scrollRef.current
        ? scrollRef.current.scrollTop
        : window.scrollY
      if (scrollTop > 0) return
      startY.current = e.touches[0].clientY
    }

    function onTouchMove(e) {
      const scrollTop = scrollRef.current
        ? scrollRef.current.scrollTop
        : window.scrollY
      if (scrollTop > 0) {
        startY.current = 0
        return
      }
      if (startY.current === 0) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) {
        setPulling(true)
        setPullY(Math.min(dy * 0.5, threshold))
        if (dy > 10) e.preventDefault()
      }
    }

    function onTouchEnd() {
      if (pulling && pullY >= threshold * 0.8) {
        onRefresh()
      }
      setPulling(false)
      setPullY(0)
      startY.current = 0
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [pulling, pullY, threshold, onRefresh])

  return { pulling, pullY, scrollRef }
}

import { useState, useEffect } from 'react'
import { scanner } from '../services/scanner'

export function useScanner() {
  const [state, setState] = useState(() => scanner.getState())

  useEffect(() => {
    return scanner.subscribe(setState)
  }, [])

  return {
    state,
    scan: scanner.scan,
    cancel: scanner.cancel,
    reset: scanner.reset,
    refreshAnalysis: scanner.refreshAnalysis,
  }
}

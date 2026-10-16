import { useEffect, useRef } from 'react'

/**
 * Tracks elapsed wall-clock time while the tab is visible, pausing while
 * it's hidden. Returns a function that reads the current elapsed ms without
 * resetting it — call it once when the session ends.
 */
export function useActiveDuration(): () => number {
  const accumulatedRef = useRef(0)
  const resumedAtRef = useRef<number | null>(
    typeof document === 'undefined' || document.visibilityState === 'visible' ? Date.now() : null
  )

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (resumedAtRef.current !== null) {
          accumulatedRef.current += Date.now() - resumedAtRef.current
          resumedAtRef.current = null
        }
      } else if (resumedAtRef.current === null) {
        resumedAtRef.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return () => {
    if (resumedAtRef.current !== null) {
      return accumulatedRef.current + (Date.now() - resumedAtRef.current)
    }
    return accumulatedRef.current
  }
}

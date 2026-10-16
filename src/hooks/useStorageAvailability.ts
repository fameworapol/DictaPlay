import { useEffect, useState } from 'react'
import { getDb } from '../lib/storage'

export type StorageAvailability = 'checking' | 'available' | 'unavailable'

/** Tracks whether IndexedDB persistence is actually working in this browser. */
export function useStorageAvailability(): StorageAvailability {
  const [status, setStatus] = useState<StorageAvailability>('checking')

  useEffect(() => {
    let cancelled = false
    getDb().then((db) => {
      if (!cancelled) setStatus(db ? 'available' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [])

  return status
}

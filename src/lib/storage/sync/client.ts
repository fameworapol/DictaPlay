import type { ExerciseProgress, SessionRecord } from '../types'

const TIMEOUT_MS = 3000

/** Read fresh per call (rather than cached at module scope) so tests can stub it per-case; Vite still inlines this at build time either way. */
function syncKey(): string | undefined {
  return import.meta.env.VITE_SYNC_API_KEY
}

function requestInit(key: string, body?: unknown): RequestInit {
  return {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-sync-key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }
}

/**
 * Every function here must never throw — a misconfigured or unreachable
 * backend should degrade the app to exactly its current IndexedDB-only
 * behavior, not break it. Same philosophy as getDb()'s .catch(() => null)
 * in ../db.ts. If VITE_SYNC_API_KEY was never set (sync not configured at
 * all), skip the network call entirely instead of making a request that
 * can only 401.
 */

export async function fetchRemoteAttempts(): Promise<ExerciseProgress[]> {
  const key = syncKey()
  if (!key) return []
  try {
    const res = await fetch('/api/attempts', requestInit(key))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as ExerciseProgress[]
  } catch (error) {
    console.warn('[sync] fetchRemoteAttempts failed:', error)
    return []
  }
}

export async function pushAttempt(progress: ExerciseProgress): Promise<void> {
  const key = syncKey()
  if (!key) return
  try {
    const res = await fetch('/api/attempts', requestInit(key, progress))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    console.warn('[sync] pushAttempt failed:', error)
  }
}

export async function fetchRemoteSessions(): Promise<SessionRecord[]> {
  const key = syncKey()
  if (!key) return []
  try {
    const res = await fetch('/api/sessions', requestInit(key))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as SessionRecord[]
  } catch (error) {
    console.warn('[sync] fetchRemoteSessions failed:', error)
    return []
  }
}

export async function pushSession(record: SessionRecord): Promise<void> {
  const key = syncKey()
  if (!key) return
  try {
    const res = await fetch('/api/sessions', requestInit(key, record))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    console.warn('[sync] pushSession failed:', error)
  }
}

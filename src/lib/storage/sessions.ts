import { getDb } from './db'
import { fetchRemoteSessions, pushSession } from './sync/client'
import { mergeSessionLists } from './sync/merge'
import type { SessionRecord } from './types'

export async function saveSession(record: SessionRecord): Promise<void> {
  const db = await getDb()
  if (!db) return
  await db.put('sessions', record)
  void pushSession(record)
}

/**
 * Returns the merged view of local + remote sessions (a simple union keyed
 * by id — sessions are immutable once created, so there's no field-level
 * conflict to resolve), writing any remote-only sessions into IndexedDB and
 * re-pushing any local-only ones (fire-and-forget) so both sides converge.
 */
export async function getAllSessions(): Promise<SessionRecord[]> {
  const db = await getDb()
  if (!db) return []

  const [local, remote] = await Promise.all([db.getAll('sessions'), fetchRemoteSessions()])
  const merged = mergeSessionLists(local, remote)

  const localIds = new Set(local.map((s) => s.id))
  const remoteIds = new Set(remote.map((s) => s.id))
  for (const session of merged) {
    if (!localIds.has(session.id)) void db.put('sessions', session)
    if (!remoteIds.has(session.id)) void pushSession(session)
  }

  return merged
}

export async function getLastSession(): Promise<SessionRecord | null> {
  const sessions = await getAllSessions()
  if (sessions.length === 0) return null
  return sessions.reduce((latest, s) => (s.endedAt > latest.endedAt ? s : latest))
}

import { getDb } from './db'
import type { SessionRecord } from './types'

export async function saveSession(record: SessionRecord): Promise<void> {
  const db = await getDb()
  if (!db) return
  await db.put('sessions', record)
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  const db = await getDb()
  if (!db) return []
  return db.getAll('sessions')
}

export async function getLastSession(): Promise<SessionRecord | null> {
  const sessions = await getAllSessions()
  if (sessions.length === 0) return null
  return sessions.reduce((latest, s) => (s.endedAt > latest.endedAt ? s : latest))
}

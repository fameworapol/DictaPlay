import { createClient, type Client } from '@libsql/client'

const CREATE_ATTEMPTS_TABLE = `
  CREATE TABLE IF NOT EXISTS attempts (
    exercise_id TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    best_score REAL NOT NULL,
    last_result TEXT NOT NULL,
    completed INTEGER NOT NULL,
    last_practiced_at INTEGER NOT NULL
  )
`

const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    lesson_title TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    attempted INTEGER NOT NULL,
    completed INTEGER NOT NULL,
    exact_matches INTEGER NOT NULL,
    error_incorrect INTEGER NOT NULL,
    error_missing INTEGER NOT NULL,
    error_extra INTEGER NOT NULL,
    active_duration_ms INTEGER NOT NULL
  )
`

let clientPromise: Promise<Client> | null = null

/**
 * Lazily creates and memoizes the libSQL client, and makes sure both tables
 * exist. Runs once per cold start (mirrors getDb()'s memoization pattern in
 * src/lib/storage/db.ts, server-side) so the schema self-heals even if the
 * Turso database is recreated — no manual migration step for the user.
 */
export function getTursoClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const url = process.env.TURSO_DATABASE_URL
      const authToken = process.env.TURSO_AUTH_TOKEN
      if (!url || !authToken) {
        throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are not configured.')
      }
      const client = createClient({ url, authToken })
      await client.execute(CREATE_ATTEMPTS_TABLE)
      await client.execute(CREATE_SESSIONS_TABLE)
      return client
    })().catch((error) => {
      clientPromise = null // let the next request retry instead of caching a permanent failure
      throw error
    })
  }
  return clientPromise
}

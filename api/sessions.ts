import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SessionRecord } from '../src/lib/storage/types'
import { isAuthorized } from './_lib/auth'
import { fromSessionRow, isValidSessionRecord, toSessionRow, type SessionRow } from './_lib/mappers'
import { getTursoClient } from './_lib/turso'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Validate method/body before touching Turso, so a malformed request gets
  // the right status code (400/405) instead of a 500 from an unnecessary DB
  // connection attempt, and fails fast without that round-trip.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let session: SessionRecord | undefined
  if (req.method === 'POST') {
    const rawBody: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!isValidSessionRecord(rawBody)) {
      res.status(400).json({ error: 'Invalid SessionRecord payload' })
      return
    }
    session = rawBody
  }

  try {
    const client = await getTursoClient()

    if (req.method === 'GET') {
      const result = await client.execute('SELECT * FROM sessions')
      const rows = result.rows as unknown as SessionRow[]
      res.status(200).json(rows.map(fromSessionRow))
      return
    }

    // req.method === 'POST' here; `session` was validated above.
    const row = toSessionRow(session!)
    await client.execute({
      sql: `INSERT INTO sessions (id, lesson_id, lesson_title, started_at, ended_at, attempted,
              completed, exact_matches, error_incorrect, error_missing, error_extra, active_duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              lesson_id = excluded.lesson_id,
              lesson_title = excluded.lesson_title,
              started_at = excluded.started_at,
              ended_at = excluded.ended_at,
              attempted = excluded.attempted,
              completed = excluded.completed,
              exact_matches = excluded.exact_matches,
              error_incorrect = excluded.error_incorrect,
              error_missing = excluded.error_missing,
              error_extra = excluded.error_extra,
              active_duration_ms = excluded.active_duration_ms`,
      args: [
        row.id,
        row.lesson_id,
        row.lesson_title,
        row.started_at,
        row.ended_at,
        row.attempted,
        row.completed,
        row.exact_matches,
        row.error_incorrect,
        row.error_missing,
        row.error_extra,
        row.active_duration_ms,
      ],
    })
    res.status(204).end()
  } catch (error) {
    console.error('[api/sessions]', error)
    res.status(500).json({ error: 'Internal error' })
  }
}

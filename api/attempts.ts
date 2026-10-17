import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ExerciseProgress } from '../src/lib/storage/types'
import { isAuthorized } from './_lib/auth'
import { fromAttemptRow, isValidExerciseProgress, toAttemptRow, type AttemptRow } from './_lib/mappers'
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

  let progress: ExerciseProgress | undefined
  if (req.method === 'POST') {
    const rawBody: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!isValidExerciseProgress(rawBody)) {
      res.status(400).json({ error: 'Invalid ExerciseProgress payload' })
      return
    }
    progress = rawBody
  }

  try {
    const client = await getTursoClient()

    if (req.method === 'GET') {
      const result = await client.execute('SELECT * FROM attempts')
      const rows = result.rows as unknown as AttemptRow[]
      res.status(200).json(rows.map(fromAttemptRow))
      return
    }

    // req.method === 'POST' here; `progress` was validated above.
    const row = toAttemptRow(progress!)
    await client.execute({
      sql: `INSERT INTO attempts (exercise_id, attempts, best_score, last_result, completed, last_practiced_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(exercise_id) DO UPDATE SET
              attempts = excluded.attempts,
              best_score = excluded.best_score,
              last_result = excluded.last_result,
              completed = excluded.completed,
              last_practiced_at = excluded.last_practiced_at`,
      args: [row.exercise_id, row.attempts, row.best_score, row.last_result, row.completed, row.last_practiced_at],
    })
    res.status(204).end()
  } catch (error) {
    console.error('[api/attempts]', error)
    res.status(500).json({ error: 'Internal error' })
  }
}

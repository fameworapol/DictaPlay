import type { ExerciseProgress, SessionRecord } from '../../src/lib/storage/types'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

/** Validates the shape of a client-submitted ExerciseProgress before it touches the database. */
export function isValidExerciseProgress(x: unknown): x is ExerciseProgress {
  if (!isRecord(x)) return false
  if (typeof x.exerciseId !== 'string' || x.exerciseId.length === 0) return false
  if (!isFiniteNumber(x.attempts)) return false
  if (!isFiniteNumber(x.bestScore)) return false
  if (typeof x.completed !== 'boolean') return false
  if (!isFiniteNumber(x.lastPracticedAt)) return false
  if (!isRecord(x.lastResult)) return false
  const r = x.lastResult
  if (!isFiniteNumber(r.correct) || !isFiniteNumber(r.incorrect)) return false
  if (!isFiniteNumber(r.missing) || !isFiniteNumber(r.extra)) return false
  if (typeof r.isExactMatch !== 'boolean') return false
  return true
}

/** Validates the shape of a client-submitted SessionRecord before it touches the database. */
export function isValidSessionRecord(x: unknown): x is SessionRecord {
  if (!isRecord(x)) return false
  if (typeof x.id !== 'string' || x.id.length === 0) return false
  if (typeof x.lessonId !== 'string' || x.lessonId.length === 0) return false
  if (typeof x.lessonTitle !== 'string') return false
  if (!isFiniteNumber(x.startedAt) || !isFiniteNumber(x.endedAt)) return false
  if (!isFiniteNumber(x.attempted) || !isFiniteNumber(x.completed)) return false
  if (!isFiniteNumber(x.exactMatches)) return false
  if (!isFiniteNumber(x.activeDurationMs)) return false
  if (!isRecord(x.errorTotals)) return false
  const e = x.errorTotals
  if (!isFiniteNumber(e.incorrect) || !isFiniteNumber(e.missing) || !isFiniteNumber(e.extra)) return false
  return true
}

/** One row of the `attempts` table, as stored/returned by libSQL (snake_case, SQLite types). */
export interface AttemptRow {
  exercise_id: string
  attempts: number
  best_score: number
  last_result: string
  completed: number
  last_practiced_at: number
}

export function toAttemptRow(progress: ExerciseProgress): AttemptRow {
  return {
    exercise_id: progress.exerciseId,
    attempts: progress.attempts,
    best_score: progress.bestScore,
    last_result: JSON.stringify(progress.lastResult),
    completed: progress.completed ? 1 : 0,
    last_practiced_at: progress.lastPracticedAt,
  }
}

export function fromAttemptRow(row: AttemptRow): ExerciseProgress {
  return {
    exerciseId: row.exercise_id,
    attempts: row.attempts,
    bestScore: row.best_score,
    lastResult: JSON.parse(row.last_result) as ExerciseProgress['lastResult'],
    completed: row.completed === 1,
    lastPracticedAt: row.last_practiced_at,
  }
}

/** One row of the `sessions` table, as stored/returned by libSQL (snake_case, SQLite types). */
export interface SessionRow {
  id: string
  lesson_id: string
  lesson_title: string
  started_at: number
  ended_at: number
  attempted: number
  completed: number
  exact_matches: number
  error_incorrect: number
  error_missing: number
  error_extra: number
  active_duration_ms: number
}

export function toSessionRow(session: SessionRecord): SessionRow {
  return {
    id: session.id,
    lesson_id: session.lessonId,
    lesson_title: session.lessonTitle,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    attempted: session.attempted,
    completed: session.completed,
    exact_matches: session.exactMatches,
    error_incorrect: session.errorTotals.incorrect,
    error_missing: session.errorTotals.missing,
    error_extra: session.errorTotals.extra,
    active_duration_ms: session.activeDurationMs,
  }
}

export function fromSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    attempted: row.attempted,
    completed: row.completed,
    exactMatches: row.exact_matches,
    errorTotals: {
      incorrect: row.error_incorrect,
      missing: row.error_missing,
      extra: row.error_extra,
    },
    activeDurationMs: row.active_duration_ms,
  }
}

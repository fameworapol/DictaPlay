import type { ComparisonResult } from '../text-comparison'
import { getDb } from './db'
import type { ExerciseProgress } from './types'

function scoreFor(result: ComparisonResult): number {
  const total = result.counts.correct + result.counts.incorrect + result.counts.missing
  return total === 0 ? 0 : result.counts.correct / total
}

/**
 * Records one Check press. Upserts the single ExerciseProgress record for
 * this exercise (retrying updates the same record, never a new row).
 */
export async function recordAttempt(
  exerciseId: string,
  result: ComparisonResult
): Promise<ExerciseProgress | null> {
  const db = await getDb()
  if (!db) return null

  const existing = await db.get('attempts', exerciseId)
  const next: ExerciseProgress = {
    exerciseId,
    attempts: (existing?.attempts ?? 0) + 1,
    bestScore: Math.max(existing?.bestScore ?? 0, scoreFor(result)),
    lastResult: { ...result.counts, isExactMatch: result.isExactMatch },
    completed: true,
    lastPracticedAt: Date.now(),
  }
  await db.put('attempts', next)
  return next
}

export async function getProgress(exerciseId: string): Promise<ExerciseProgress | null> {
  const db = await getDb()
  if (!db) return null
  return (await db.get('attempts', exerciseId)) ?? null
}

export async function getAllProgress(): Promise<ExerciseProgress[]> {
  const db = await getDb()
  if (!db) return []
  return db.getAll('attempts')
}

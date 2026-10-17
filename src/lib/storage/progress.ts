import type { ComparisonResult } from '../text-comparison'
import { getDb } from './db'
import { fetchRemoteAttempts, pushAttempt } from './sync/client'
import { mergeProgress } from './sync/merge'
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
  void pushAttempt(next)
  return next
}

export async function getProgress(exerciseId: string): Promise<ExerciseProgress | null> {
  const db = await getDb()
  if (!db) return null
  return (await db.get('attempts', exerciseId)) ?? null
}

/**
 * Returns the merged view of local + remote progress, reconciling both
 * sides back to convergence: any row where the merge differs from what's
 * locally stored is written into IndexedDB, and any row where the merge
 * differs from the remote is re-pushed (fire-and-forget) — so a lost update
 * from a near-simultaneous write on two devices self-heals on the next call.
 */
export async function getAllProgress(): Promise<ExerciseProgress[]> {
  const db = await getDb()
  if (!db) return []

  const [local, remote] = await Promise.all([db.getAll('attempts'), fetchRemoteAttempts()])
  const remoteById = new Map(remote.map((p) => [p.exerciseId, p]))
  const localById = new Map(local.map((p) => [p.exerciseId, p]))
  const exerciseIds = new Set([...localById.keys(), ...remoteById.keys()])

  const merged: ExerciseProgress[] = []
  for (const exerciseId of exerciseIds) {
    const result = mergeProgress(localById.get(exerciseId) ?? null, remoteById.get(exerciseId) ?? null)
    if (!result) continue
    merged.push(result)

    const localValue = localById.get(exerciseId)
    if (!localValue || JSON.stringify(localValue) !== JSON.stringify(result)) {
      void db.put('attempts', result)
    }
    const remoteValue = remoteById.get(exerciseId)
    if (!remoteValue || JSON.stringify(remoteValue) !== JSON.stringify(result)) {
      void pushAttempt(result)
    }
  }

  return merged
}

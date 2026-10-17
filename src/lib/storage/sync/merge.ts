import type { ExerciseProgress, SessionRecord } from '../types'

/**
 * Merges one exercise's local and remote progress. Deliberately not a
 * whole-record last-write-wins (which can silently regress bestScore — e.g.
 * device A practiced twice more recently than device B's single perfect
 * attempt; naive LWW would pick A's record and lose B's 1.0 score).
 * Instead: attempts/bestScore take the max of both sides; the rest of the
 * record (lastResult/completed/lastPracticedAt) comes from whichever side
 * was practiced more recently (ties favor local).
 */
export function mergeProgress(
  local: ExerciseProgress | null,
  remote: ExerciseProgress | null
): ExerciseProgress | null {
  if (!local) return remote
  if (!remote) return local

  const newer = remote.lastPracticedAt > local.lastPracticedAt ? remote : local

  return {
    exerciseId: local.exerciseId,
    attempts: Math.max(local.attempts, remote.attempts),
    bestScore: Math.max(local.bestScore, remote.bestScore),
    lastResult: newer.lastResult,
    completed: newer.completed,
    lastPracticedAt: newer.lastPracticedAt,
  }
}

/**
 * Sessions are immutable once created (a fresh id per completed lesson), so
 * merging two lists is just a union keyed by id — no field-level conflict
 * is possible in practice.
 */
export function mergeSessionLists(local: SessionRecord[], remote: SessionRecord[]): SessionRecord[] {
  const byId = new Map<string, SessionRecord>()
  for (const session of local) byId.set(session.id, session)
  for (const session of remote) if (!byId.has(session.id)) byId.set(session.id, session)
  return [...byId.values()]
}

import { describe, expect, it } from 'vitest'
import { mergeProgress, mergeSessionLists } from '../../src/lib/storage/sync/merge'
import type { ExerciseProgress, SessionRecord } from '../../src/lib/storage/types'

function progress(overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    exerciseId: 'ex-1',
    attempts: 1,
    bestScore: 0.5,
    lastResult: { correct: 2, incorrect: 2, missing: 0, extra: 0, isExactMatch: false },
    completed: true,
    lastPracticedAt: 1000,
    ...overrides,
  }
}

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    lessonId: 'lesson-1',
    lessonTitle: 'Lesson 1',
    startedAt: 0,
    endedAt: 1000,
    attempted: 1,
    completed: 1,
    exactMatches: 0,
    errorTotals: { incorrect: 1, missing: 0, extra: 0 },
    activeDurationMs: 1000,
    ...overrides,
  }
}

describe('mergeProgress', () => {
  it('returns the other side when one side is null', () => {
    const p = progress()
    expect(mergeProgress(p, null)).toEqual(p)
    expect(mergeProgress(null, p)).toEqual(p)
  })

  it('returns null when both sides are null', () => {
    expect(mergeProgress(null, null)).toBeNull()
  })

  it('takes the max of attempts and bestScore from both sides', () => {
    const local = progress({ attempts: 2, bestScore: 0.4, lastPracticedAt: 500 })
    const remote = progress({ attempts: 5, bestScore: 0.9, lastPracticedAt: 100 })
    const merged = mergeProgress(local, remote)
    expect(merged?.attempts).toBe(5)
    expect(merged?.bestScore).toBe(0.9)
  })

  it('never regresses bestScore even when the more-recent side has a lower score (the naive-LWW bug)', () => {
    // Device A practiced more recently but did worse; device B has an older perfect score.
    const local = progress({ attempts: 3, bestScore: 1.0, lastPracticedAt: 100 }) // device B
    const remote = progress({ attempts: 4, bestScore: 0.3, lastPracticedAt: 999 }) // device A, more recent
    const merged = mergeProgress(local, remote)
    expect(merged?.bestScore).toBe(1.0) // must not regress to 0.3
    expect(merged?.attempts).toBe(4) // attempts still takes the max
  })

  it('takes lastResult/completed/lastPracticedAt from whichever side practiced more recently', () => {
    const olderResult = { correct: 1, incorrect: 1, missing: 0, extra: 0, isExactMatch: false }
    const newerResult = { correct: 5, incorrect: 0, missing: 0, extra: 0, isExactMatch: true }
    const local = progress({ lastResult: olderResult, lastPracticedAt: 100, completed: true })
    const remote = progress({ lastResult: newerResult, lastPracticedAt: 500, completed: true })
    const merged = mergeProgress(local, remote)
    expect(merged?.lastResult).toEqual(newerResult)
    expect(merged?.lastPracticedAt).toBe(500)
  })

  it('prefers local on an exact lastPracticedAt tie', () => {
    const local = progress({ lastResult: { correct: 1, incorrect: 0, missing: 0, extra: 0, isExactMatch: true }, lastPracticedAt: 100 })
    const remote = progress({ lastResult: { correct: 0, incorrect: 1, missing: 0, extra: 0, isExactMatch: false }, lastPracticedAt: 100 })
    const merged = mergeProgress(local, remote)
    expect(merged?.lastResult.isExactMatch).toBe(true)
  })
})

describe('mergeSessionLists', () => {
  it('unions two disjoint lists', () => {
    const local = [session({ id: 'a' })]
    const remote = [session({ id: 'b' })]
    const merged = mergeSessionLists(local, remote)
    expect(merged.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('deduplicates by id, preferring the local copy', () => {
    const local = [session({ id: 'a', lessonTitle: 'Local copy' })]
    const remote = [session({ id: 'a', lessonTitle: 'Remote copy' })]
    const merged = mergeSessionLists(local, remote)
    expect(merged).toHaveLength(1)
    expect(merged[0].lessonTitle).toBe('Local copy')
  })

  it('returns an empty array when both sides are empty', () => {
    expect(mergeSessionLists([], [])).toEqual([])
  })
})

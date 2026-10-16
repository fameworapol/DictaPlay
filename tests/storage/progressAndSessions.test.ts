// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, resetDbCacheForTests } from '../../src/lib/storage/db'
import { getAllProgress, getProgress, recordAttempt } from '../../src/lib/storage/progress'
import { getAllSessions, getLastSession, saveSession } from '../../src/lib/storage/sessions'
import { resetStorageForTests } from './testUtils'

beforeEach(resetStorageForTests)

function result(correct: number, incorrect: number, missing: number, extra: number) {
  return {
    words: [],
    counts: { correct, incorrect, missing, extra },
    isExactMatch: incorrect === 0 && missing === 0 && extra === 0,
  }
}

/** Mirrors the spec's test scenario: load lesson -> answer -> retry -> complete session -> reload. */
describe('practice history persistence', () => {
  it('upserts the same ExerciseProgress record across retries instead of creating new rows', async () => {
    const exerciseId = 'ex-001'

    await recordAttempt(exerciseId, result(2, 3, 0, 0)) // first Check: imperfect
    let progress = await getProgress(exerciseId)
    expect(progress).toMatchObject({ attempts: 1, completed: true })
    expect(progress!.bestScore).toBeCloseTo(0.4) // 2/5

    await recordAttempt(exerciseId, result(5, 0, 0, 0)) // retry: now exact
    progress = await getProgress(exerciseId)
    expect(progress!.attempts).toBe(2) // same record, count incremented
    expect(progress!.bestScore).toBe(1)
    expect(progress!.lastResult.isExactMatch).toBe(true)

    const all = await getAllProgress()
    expect(all).toHaveLength(1) // still exactly one row for this exercise
  })

  it('persists a completed session record with its stats', async () => {
    await saveSession({
      id: 'session-1',
      lessonId: 'lesson-sample-easy',
      lessonTitle: 'Sample Easy',
      startedAt: 1000,
      endedAt: 5000,
      attempted: 3,
      completed: 3,
      exactMatches: 2,
      errorTotals: { incorrect: 1, missing: 0, extra: 0 },
      activeDurationMs: 4000,
    })

    const sessions = await getAllSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ attempted: 3, completed: 3, exactMatches: 2 })
  })

  it('survives a simulated reload (fresh DB connection, same underlying data)', async () => {
    const exerciseId = 'ex-reload'
    await recordAttempt(exerciseId, result(4, 1, 0, 0))
    await saveSession({
      id: 'session-reload',
      lessonId: 'lesson-x',
      lessonTitle: 'Lesson X',
      startedAt: 0,
      endedAt: 1000,
      attempted: 1,
      completed: 1,
      exactMatches: 0,
      errorTotals: { incorrect: 1, missing: 0, extra: 0 },
      activeDurationMs: 1000,
    })

    // A page reload re-runs module init (closing the old connection first,
    // which a real reload does implicitly by destroying the JS context) and
    // re-opens the DB connection, landing on the same underlying data.
    const oldDb = await getDb()
    oldDb?.close()
    resetDbCacheForTests()

    const progress = await getProgress(exerciseId)
    expect(progress?.attempts).toBe(1)
    expect(progress?.completed).toBe(true)

    const lastSession = await getLastSession()
    expect(lastSession?.id).toBe('session-reload')
  })

  it('shows real zeros / nulls on a fresh browser with no history', async () => {
    expect(await getAllProgress()).toEqual([])
    expect(await getAllSessions()).toEqual([])
    expect(await getProgress('nonexistent')).toBeNull()
    expect(await getLastSession()).toBeNull()
  })
})

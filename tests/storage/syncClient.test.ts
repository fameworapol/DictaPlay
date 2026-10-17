import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchRemoteAttempts,
  fetchRemoteSessions,
  pushAttempt,
  pushSession,
} from '../../src/lib/storage/sync/client'
import type { ExerciseProgress, SessionRecord } from '../../src/lib/storage/types'

const progress: ExerciseProgress = {
  exerciseId: 'ex-1',
  attempts: 1,
  bestScore: 1,
  lastResult: { correct: 1, incorrect: 0, missing: 0, extra: 0, isExactMatch: true },
  completed: true,
  lastPracticedAt: Date.now(),
}

const session: SessionRecord = {
  id: 'session-1',
  lessonId: 'lesson-1',
  lessonTitle: 'Lesson 1',
  startedAt: 0,
  endedAt: 1000,
  attempted: 1,
  completed: 1,
  exactMatches: 1,
  errorTotals: { incorrect: 0, missing: 0, extra: 0 },
  activeDurationMs: 1000,
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sync client when VITE_SYNC_API_KEY is not configured', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SYNC_API_KEY', '')
  })

  it('skips the network call entirely for every function', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await fetchRemoteAttempts()).toEqual([])
    expect(await fetchRemoteSessions()).toEqual([])
    await pushAttempt(progress)
    await pushSession(session)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('sync client when configured but the network fails', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SYNC_API_KEY', 'test-key')
  })

  it('fetchRemoteAttempts resolves to [] instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchRemoteAttempts()).resolves.toEqual([])
  })

  it('fetchRemoteSessions resolves to [] instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchRemoteSessions()).resolves.toEqual([])
  })

  it('pushAttempt resolves instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(pushAttempt(progress)).resolves.toBeUndefined()
  })

  it('pushSession resolves instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(pushSession(session)).resolves.toBeUndefined()
  })

  it('treats a non-ok HTTP response as a failure too, not just a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    await expect(fetchRemoteAttempts()).resolves.toEqual([])
  })

  it('sends the configured key as the x-sync-key header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await fetchRemoteAttempts()

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-sync-key']).toBe('test-key')
  })

  it('returns the parsed JSON on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([progress]), { status: 200 })))
    await expect(fetchRemoteAttempts()).resolves.toEqual([progress])
  })
})

import { describe, expect, it } from 'vitest'
import {
  fromAttemptRow,
  fromSessionRow,
  isValidExerciseProgress,
  isValidSessionRecord,
  toAttemptRow,
  toSessionRow,
} from '../../api/_lib/mappers'
import type { ExerciseProgress, SessionRecord } from '../../src/lib/storage/types'

function validProgress(): ExerciseProgress {
  return {
    exerciseId: 'ex-1',
    attempts: 3,
    bestScore: 0.75,
    lastResult: { correct: 3, incorrect: 1, missing: 0, extra: 0, isExactMatch: false },
    completed: true,
    lastPracticedAt: 1700000000000,
  }
}

function validSession(): SessionRecord {
  return {
    id: 'session-1',
    lessonId: 'lesson-1',
    lessonTitle: 'Lesson 1',
    startedAt: 1700000000000,
    endedAt: 1700000005000,
    attempted: 3,
    completed: 3,
    exactMatches: 2,
    errorTotals: { incorrect: 1, missing: 0, extra: 0 },
    activeDurationMs: 5000,
  }
}

describe('isValidExerciseProgress', () => {
  it('accepts a well-formed record', () => {
    expect(isValidExerciseProgress(validProgress())).toBe(true)
  })

  it('rejects null/non-object input', () => {
    expect(isValidExerciseProgress(null)).toBe(false)
    expect(isValidExerciseProgress('nope')).toBe(false)
    expect(isValidExerciseProgress(42)).toBe(false)
  })

  it('rejects a missing exerciseId', () => {
    const withoutId: Partial<ExerciseProgress> = { ...validProgress() }
    delete withoutId.exerciseId
    expect(isValidExerciseProgress(withoutId)).toBe(false)
  })

  it('rejects a non-finite number field', () => {
    expect(isValidExerciseProgress({ ...validProgress(), attempts: NaN })).toBe(false)
    expect(isValidExerciseProgress({ ...validProgress(), bestScore: Infinity })).toBe(false)
  })

  it('rejects a malformed lastResult', () => {
    expect(isValidExerciseProgress({ ...validProgress(), lastResult: { correct: 1 } })).toBe(false)
    expect(isValidExerciseProgress({ ...validProgress(), lastResult: 'nope' })).toBe(false)
  })
})

describe('isValidSessionRecord', () => {
  it('accepts a well-formed record', () => {
    expect(isValidSessionRecord(validSession())).toBe(true)
  })

  it('rejects null/non-object input', () => {
    expect(isValidSessionRecord(null)).toBe(false)
    expect(isValidSessionRecord([])).toBe(false)
  })

  it('rejects a missing id', () => {
    const withoutId: Partial<SessionRecord> = { ...validSession() }
    delete withoutId.id
    expect(isValidSessionRecord(withoutId)).toBe(false)
  })

  it('rejects a malformed errorTotals', () => {
    expect(isValidSessionRecord({ ...validSession(), errorTotals: { incorrect: 1 } })).toBe(false)
  })
})

describe('attempt row mapping round-trip', () => {
  it('toAttemptRow -> fromAttemptRow reproduces the original record', () => {
    const original = validProgress()
    expect(fromAttemptRow(toAttemptRow(original))).toEqual(original)
  })

  it('encodes completed as 0/1 and lastResult as a JSON string', () => {
    const row = toAttemptRow(validProgress())
    expect(row.completed).toBe(1)
    expect(typeof row.last_result).toBe('string')
    expect(JSON.parse(row.last_result)).toEqual(validProgress().lastResult)
  })

  it('round-trips completed: false correctly (not just truthy/falsy)', () => {
    const original = { ...validProgress(), completed: false }
    const row = toAttemptRow(original)
    expect(row.completed).toBe(0)
    expect(fromAttemptRow(row).completed).toBe(false)
  })
})

describe('session row mapping round-trip', () => {
  it('toSessionRow -> fromSessionRow reproduces the original record', () => {
    const original = validSession()
    expect(fromSessionRow(toSessionRow(original))).toEqual(original)
  })

  it('flattens errorTotals into three columns and back', () => {
    const row = toSessionRow(validSession())
    expect(row.error_incorrect).toBe(1)
    expect(row.error_missing).toBe(0)
    expect(row.error_extra).toBe(0)
  })
})

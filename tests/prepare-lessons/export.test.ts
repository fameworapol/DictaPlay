import { describe, expect, it } from 'vitest'
import { groupIntoLessons } from '../../scripts/prepare-lessons/export'
import type { CandidateClip } from '../../scripts/prepare-lessons/types'

function clip(overrides: Partial<CandidateClip>): CandidateClip {
  return {
    id: 'id',
    source: 'Movie_One',
    difficulty: 'easy',
    start: 0,
    end: 1,
    text: 'Text.',
    status: 'approved',
    flags: [],
    ...overrides,
  }
}

describe('groupIntoLessons', () => {
  it('excludes clips that are not approved', () => {
    const { lessons, exercises } = groupIntoLessons([
      clip({ id: 'a', status: 'approved' }),
      clip({ id: 'b', status: 'pending' }),
      clip({ id: 'c', status: 'needs_correction' }),
    ])
    expect(exercises.map((e) => e.id)).toEqual(['a'])
    expect(lessons).toHaveLength(1)
  })

  it('orders exercises within a lesson chronologically by start time', () => {
    const { exercises } = groupIntoLessons([
      clip({ id: 'late', start: 100, end: 101 }),
      clip({ id: 'early', start: 1, end: 2 }),
      clip({ id: 'mid', start: 50, end: 51 }),
    ])
    expect(exercises.map((e) => e.id)).toEqual(['early', 'mid', 'late'])
  })

  it('splits a long movie into multiple lessons of at most 8 exercises', () => {
    const clips = Array.from({ length: 20 }, (_, i) =>
      clip({ id: `c${i}`, start: i, end: i + 1 })
    )
    const { lessons, exercises } = groupIntoLessons(clips)
    expect(lessons).toHaveLength(3) // 8 + 8 + 4
    expect(lessons[0].exerciseIds).toHaveLength(8)
    expect(lessons[2].exerciseIds).toHaveLength(4)
    expect(exercises).toHaveLength(20)
  })

  it('groups different source movies into separate lessons', () => {
    const { lessons } = groupIntoLessons([
      clip({ id: 'a1', source: 'Movie_A', start: 0, end: 1 }),
      clip({ id: 'b1', source: 'Movie_B', start: 0, end: 1 }),
    ])
    expect(lessons).toHaveLength(2)
    expect(lessons.map((l) => l.source)).toEqual(['builtin', 'builtin'])
  })

  it('produces an audioPath under audio/built-in/<difficulty>/<id>.m4a', () => {
    const { exercises } = groupIntoLessons([clip({ id: 'xyz', difficulty: 'hard' })])
    expect(exercises[0].audioPath).toBe('audio/built-in/hard/xyz.m4a')
  })

  it('carries the candidate text through as the exercise transcript unmodified', () => {
    const { exercises } = groupIntoLessons([clip({ id: 'a', text: 'Exact text.' })])
    expect(exercises[0].transcript).toBe('Exact text.')
  })

  it('returns empty lessons/exercises when nothing is approved', () => {
    const { lessons, exercises } = groupIntoLessons([clip({ status: 'pending' })])
    expect(lessons).toEqual([])
    expect(exercises).toEqual([])
  })
})

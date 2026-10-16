import { describe, expect, it } from 'vitest'
import { validateProductionIndex } from '../../scripts/validate-lessons/validator'
import type { LessonIndex } from '../../src/types/lesson'

function baseIndex(): LessonIndex {
  return {
    lessons: [
      { id: 'lesson-1', title: 'Lesson 1', difficulty: 'easy', source: 'builtin', exerciseIds: ['ex-1'] },
    ],
    exercises: [
      {
        id: 'ex-1',
        lessonId: 'lesson-1',
        title: 'Ex 1',
        difficulty: 'easy',
        audioPath: 'audio/built-in/easy/ex-1.m4a',
        transcript: 'Hello.',
      },
    ],
  }
}

const audioAlwaysExists = () => true
const audioNeverExists = () => false

describe('validateProductionIndex', () => {
  it('passes a well-formed production index', () => {
    expect(validateProductionIndex(baseIndex(), audioAlwaysExists)).toEqual([])
  })

  it('flags a missing audio file', () => {
    const issues = validateProductionIndex(baseIndex(), audioNeverExists)
    expect(issues.some((i) => i.message.includes('does not exist'))).toBe(true)
  })

  it('flags a lesson referencing a nonexistent exercise', () => {
    const index = baseIndex()
    index.lessons[0].exerciseIds.push('ex-missing')
    const issues = validateProductionIndex(index, audioAlwaysExists)
    expect(issues.some((i) => i.message.includes('ex-missing'))).toBe(true)
  })

  it('flags an exercise referencing a nonexistent lesson', () => {
    const index = baseIndex()
    index.exercises[0].lessonId = 'lesson-missing'
    const issues = validateProductionIndex(index, audioAlwaysExists)
    expect(issues.some((i) => i.message.includes('lesson-missing'))).toBe(true)
  })

  it('flags sample-folder audio missing its sourceId label', () => {
    const index = baseIndex()
    index.exercises[0].audioPath = 'audio/sample/easy/ex-1.m4a'
    // sourceId intentionally left unset
    const issues = validateProductionIndex(index, audioAlwaysExists)
    expect(issues.some((i) => i.message.includes('no sourceId'))).toBe(true)
  })

  it('accepts sample-folder audio that does carry a sourceId', () => {
    const index = baseIndex()
    index.exercises[0].audioPath = 'audio/sample/easy/ex-1.m4a'
    index.exercises[0].sourceId = 'sample-tts'
    expect(validateProductionIndex(index, audioAlwaysExists)).toEqual([])
  })

  it('flags built-in production audio that incorrectly carries a sourceId', () => {
    const index = baseIndex()
    index.exercises[0].sourceId = 'sample-tts' // would wrongly show "Sample" on real content
    const issues = validateProductionIndex(index, audioAlwaysExists)
    expect(issues.some((i) => i.message.includes('mislabel'))).toBe(true)
  })

  it('flags an exercise with no audioPath at all', () => {
    const index = baseIndex()
    // @ts-expect-error intentionally testing a malformed record
    delete index.exercises[0].audioPath
    const issues = validateProductionIndex(index, audioAlwaysExists)
    expect(issues.some((i) => i.message.includes('no audioPath'))).toBe(true)
  })

  it('passes an empty index', () => {
    expect(validateProductionIndex({ lessons: [], exercises: [] }, audioAlwaysExists)).toEqual([])
  })
})

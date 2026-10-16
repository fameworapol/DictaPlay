import { describe, expect, it } from 'vitest'
import {
  detectSegmentFlags,
  findDuplicateTextIndices,
  isMusicLyricText,
  isTooShortToBeASentence,
} from '../../scripts/prepare-lessons/flags'

describe('detectSegmentFlags', () => {
  it('flags nothing for a normal sentence', () => {
    expect(detectSegmentFlags({ text: 'The boy is playing football.', start: 0, end: 2 })).toEqual([])
  })

  it('flags an empty transcript', () => {
    expect(detectSegmentFlags({ text: '   ', start: 0, end: 2 })).toContain('empty_transcript')
  })

  it('flags an invalid range when end <= start', () => {
    expect(detectSegmentFlags({ text: 'Hi.', start: 2, end: 2 })).toContain('invalid_range')
    expect(detectSegmentFlags({ text: 'Hi.', start: 3, end: 1 })).toContain('invalid_range')
  })

  it('flags a negative start as an invalid range', () => {
    expect(detectSegmentFlags({ text: 'Hi.', start: -1, end: 1 })).toContain('invalid_range')
  })

  it('flags unrealistically fast pacing as too short for the word count', () => {
    // 12 words in 0.5s is far beyond realistic speech.
    const text = 'one two three four five six seven eight nine ten eleven twelve'
    expect(detectSegmentFlags({ text, start: 0, end: 0.5 })).toContain('too_short_for_word_count')
  })

  it('does not flag normal-pace speech as too short', () => {
    const text = 'one two three four five six'
    expect(detectSegmentFlags({ text, start: 0, end: 3 })).not.toContain('too_short_for_word_count')
  })

  it('flags a suspiciously long sentence', () => {
    const text = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ') + '.'
    expect(detectSegmentFlags({ text, start: 0, end: 20 })).toContain('suspiciously_long_sentence')
  })
})

describe('findDuplicateTextIndices', () => {
  it('finds no duplicates when all text is unique', () => {
    expect(findDuplicateTextIndices(['Hello.', 'World.', 'Goodbye.'])).toEqual(new Set())
  })

  it('finds both occurrences of a repeated line, case/space-insensitively', () => {
    const result = findDuplicateTextIndices(['Hello.', 'HELLO.', 'World.', '  hello.  '])
    expect(result).toEqual(new Set([0, 1, 3]))
  })

  it('ignores empty strings', () => {
    expect(findDuplicateTextIndices(['', ''])).toEqual(new Set())
  })
})

describe('isMusicLyricText', () => {
  it('detects the standard SRT music-note marker', () => {
    expect(isMusicLyricText('♪ Happy birthday to you ♪')).toBe(true)
  })

  it('detects a lone leading music note', () => {
    expect(isMusicLyricText('♪ Give it away now')).toBe(true)
  })

  it('does not flag ordinary dialogue', () => {
    expect(isMusicLyricText('The boy is playing football.')).toBe(false)
  })
})

describe('isTooShortToBeASentence', () => {
  it('flags a one-word interjection', () => {
    expect(isTooShortToBeASentence('Huh?')).toBe(true)
  })

  it('flags a two-word fragment', () => {
    expect(isTooShortToBeASentence('Yeah, right.')).toBe(true) // 2 words, under the default minimum of 3
  })

  it('accepts a real three-word-or-longer sentence', () => {
    expect(isTooShortToBeASentence('I am fine.')).toBe(false)
  })

  it('respects a custom minimum', () => {
    expect(isTooShortToBeASentence('One two.', 2)).toBe(false)
    expect(isTooShortToBeASentence('One two.', 5)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { compareTexts } from '../../src/lib/text-comparison'

describe('compareTexts', () => {
  it('matches an exact answer', () => {
    const result = compareTexts('The boy is playing football.', 'The boy is playing football.')
    expect(result.isExactMatch).toBe(true)
    expect(result.counts).toEqual({ correct: 5, incorrect: 0, missing: 0, extra: 0 })
    expect(result.words.every((w) => w.op === 'correct')).toBe(true)
  })

  it('is case-insensitive', () => {
    const result = compareTexts('The Boy Is Playing Football.', 'the boy is playing football.')
    expect(result.isExactMatch).toBe(true)
    expect(result.counts.correct).toBe(5)
  })

  it('ignores leading/trailing punctuation differences', () => {
    const result = compareTexts('Hello, world!', 'Hello world')
    expect(result.isExactMatch).toBe(true)
    expect(result.counts.correct).toBe(2)
  })

  it('detects a missing word without marking later words wrong', () => {
    const result = compareTexts('I like to eat apples.', 'I like eat apples.')
    expect(result.counts).toEqual({ correct: 4, incorrect: 0, missing: 1, extra: 0 })
    expect(result.words.map((w) => w.op)).toEqual([
      'correct', // I
      'correct', // like
      'missing', // to
      'correct', // eat
      'correct', // apples
    ])
  })

  it('detects an extra word', () => {
    const result = compareTexts('I like apples.', 'I really like apples.')
    expect(result.counts).toEqual({ correct: 3, incorrect: 0, missing: 0, extra: 1 })
    expect(result.words.map((w) => w.op)).toEqual(['correct', 'extra', 'correct', 'correct'])
  })

  it('detects an incorrect (substituted) word', () => {
    const result = compareTexts('She is reading a book.', 'She is writing a book.')
    expect(result.counts).toEqual({ correct: 4, incorrect: 1, missing: 0, extra: 0 })
    const incorrect = result.words.find((w) => w.op === 'incorrect')
    expect(incorrect).toMatchObject({ transcriptWord: 'reading', answerWord: 'writing' })
  })

  it('handles multiple simultaneous error types', () => {
    const result = compareTexts(
      'The quick brown fox jumps over the lazy dog.',
      'The quick red fox jumps the lazy fast dog.'
    )
    // "brown" -> "red" (incorrect), "over" missing, "fast" extra, rest correct
    expect(result.counts.incorrect).toBe(1)
    expect(result.counts.missing).toBe(1)
    expect(result.counts.extra).toBe(1)
  })

  it('keeps contractions as single words', () => {
    const result = compareTexts("I'm sure she don't know.", "I'm sure she don't know.")
    expect(result.isExactMatch).toBe(true)
    expect(result.words).toHaveLength(5)
  })

  it('treats curly and straight apostrophes as equal', () => {
    const result = compareTexts('I’m sure.', "I'm sure.")
    expect(result.isExactMatch).toBe(true)
  })

  it('keeps hyphenated words as one token', () => {
    const result = compareTexts('My mother-in-law is kind.', 'My mother-in-law is kind.')
    expect(result.isExactMatch).toBe(true)
    expect(result.words).toHaveLength(4)
  })

  it('handles repeated words correctly', () => {
    const result = compareTexts('He said no no no.', 'He said no no.')
    expect(result.counts).toEqual({ correct: 4, incorrect: 0, missing: 1, extra: 0 })
  })

  it('collapses leading, trailing and multiple internal spaces', () => {
    const result = compareTexts('  The   boy  is playing football.  ', 'The boy is playing football.')
    expect(result.isExactMatch).toBe(true)
  })

  it('does not cascade a shifted insertion into later word mismatches (spec example)', () => {
    // transcript: "The boy is playing football."
    // answer: "is" is missing, "the" is extra, everything else correct.
    const result = compareTexts('The boy is playing football.', 'The the boy playing football.')
    expect(result.counts).toEqual({ correct: 4, incorrect: 0, missing: 1, extra: 1 })
    const missing = result.words.find((w) => w.op === 'missing')
    const extra = result.words.find((w) => w.op === 'extra')
    expect(missing?.transcriptWord).toBe('is')
    expect(extra?.answerWord).toBe('The')
  })

  it('does not cascade a shifted deletion into later word mismatches', () => {
    const result = compareTexts('One two three four five.', 'One three four five.')
    expect(result.counts).toEqual({ correct: 4, incorrect: 0, missing: 1, extra: 0 })
    expect(result.words.map((w) => w.op)).toEqual([
      'correct',
      'missing',
      'correct',
      'correct',
      'correct',
    ])
  })

  it('treats numbers and their word form as incorrect (documented limitation)', () => {
    const result = compareTexts('I have 5 apples.', 'I have five apples.')
    expect(result.counts).toEqual({ correct: 3, incorrect: 1, missing: 0, extra: 0 })
  })

  it('never mutates the inputs', () => {
    const transcript = '  The Boy IS Playing.  '
    const answer = '  the boy is playing.  '
    compareTexts(transcript, answer)
    expect(transcript).toBe('  The Boy IS Playing.  ')
    expect(answer).toBe('  the boy is playing.  ')
  })
})

import { align } from './align'
import { tokenize } from './normalize'
import type { ComparisonCounts, ComparisonResult } from './types'

/**
 * Compares a user's answer against a transcript and returns a word-level
 * alignment plus counts. Pure function: never mutates either input string.
 *
 * Known limitation: numbers vs. their word form ("5" vs "five") are treated
 * as different tokens and will be marked incorrect.
 */
export function compareTexts(transcript: string, userAnswer: string): ComparisonResult {
  const reference = tokenize(transcript)
  const hypothesis = tokenize(userAnswer)
  const words = align(reference, hypothesis)

  const counts: ComparisonCounts = { correct: 0, incorrect: 0, missing: 0, extra: 0 }
  for (const word of words) counts[word.op]++

  const isExactMatch = counts.incorrect === 0 && counts.missing === 0 && counts.extra === 0

  return { words, counts, isExactMatch }
}

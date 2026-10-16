export type WordOp = 'correct' | 'incorrect' | 'missing' | 'extra'

/**
 * One aligned slot in the comparison result.
 * - correct/incorrect: both sides present.
 * - missing: present in the transcript, absent from the answer.
 * - extra: present in the answer, absent from the transcript.
 */
export interface AlignedWord {
  op: WordOp
  /** Raw (as-authored) transcript word, if this slot has one. */
  transcriptWord?: string
  /** Raw (as-typed) answer word, if this slot has one. */
  answerWord?: string
}

export interface ComparisonCounts {
  correct: number
  incorrect: number
  missing: number
  extra: number
}

export interface ComparisonResult {
  words: AlignedWord[]
  counts: ComparisonCounts
  /** True when the answer matches the transcript exactly (no incorrect/missing/extra). */
  isExactMatch: boolean
}

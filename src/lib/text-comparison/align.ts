import type { Token } from './normalize'
import type { AlignedWord } from './types'

/**
 * Word-level alignment between a reference (transcript) and hypothesis (answer)
 * token sequence, using Levenshtein-style dynamic programming (Wagner-Fischer)
 * with a full edit-op backtrace. Substitution, insertion and deletion all cost 1;
 * an exact (normalized) match costs 0.
 *
 * This guarantees the fewest total edits, so a single missing or extra word
 * never cascades into marking every later word wrong.
 *
 * Tie-break rule (deterministic, applied during backtrace when two or more
 * directions share the minimum cost at a cell): prefer, in order,
 *   1. diagonal, but only when it is an exact (normalized) match — correct
 *   2. up — deletion from the reference (missing)
 *   3. left — insertion into the hypothesis (extra)
 *   4. diagonal substitution (incorrect), only as a last resort
 * A true match is always taken when available (it is never a losing move).
 * Otherwise this rule prefers an isolated missing/extra pair over a chain of
 * substitutions, so one shifted word doesn't mark every later word wrong —
 * e.g. transcript "The boy is playing football." vs answer "The the boy
 * playing football." yields "the" extra + "is" missing, not two substitutions.
 */
export function align(reference: Token[], hypothesis: Token[]): AlignedWord[] {
  const n = reference.length
  const m = hypothesis.length

  // dp[i][j] = min edit cost to align reference[0..i) with hypothesis[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const isMatch = reference[i - 1].normalized === hypothesis[j - 1].normalized
      const diagonal = dp[i - 1][j - 1] + (isMatch ? 0 : 1)
      const up = dp[i - 1][j] + 1 // deletion -> missing
      const left = dp[i][j - 1] + 1 // insertion -> extra
      dp[i][j] = Math.min(diagonal, up, left)
    }
  }

  const words: AlignedWord[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const isMatch = i > 0 && j > 0 && reference[i - 1].normalized === hypothesis[j - 1].normalized

    if (isMatch && dp[i][j] === dp[i - 1][j - 1]) {
      words.push({
        op: 'correct',
        transcriptWord: reference[i - 1].raw,
        answerWord: hypothesis[j - 1].raw,
      })
      i--
      j--
      continue
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      words.push({ op: 'missing', transcriptWord: reference[i - 1].raw })
      i--
      continue
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      words.push({ op: 'extra', answerWord: hypothesis[j - 1].raw })
      j--
      continue
    }
    // Last resort: substitution (neither a free match nor a tied indel).
    words.push({
      op: 'incorrect',
      transcriptWord: reference[i - 1].raw,
      answerWord: hypothesis[j - 1].raw,
    })
    i--
    j--
  }

  words.reverse()
  return words
}

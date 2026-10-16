import { CountStat } from '../../components/CountStat'
import type { ComparisonResult } from '../../lib/text-comparison'

interface ResultSummaryProps {
  result: ComparisonResult
}

/**
 * Shown right after Check: says whether the answer was right, with counts,
 * but never the transcript text or which specific words matched — that
 * would give the answer away. Full detail is behind the "Show Answer" button.
 */
export function ResultSummary({ result }: ResultSummaryProps) {
  return (
    <div aria-live="polite" className="space-y-3">
      <p
        className={`text-lg font-semibold ${
          result.isExactMatch ? 'text-green-700' : 'text-amber-700'
        }`}
      >
        {result.isExactMatch ? '✓ Correct!' : '✗ Not quite right.'}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountStat label="Correct" value={result.counts.correct} />
        <CountStat label="Incorrect" value={result.counts.incorrect} />
        <CountStat label="Missing" value={result.counts.missing} />
        <CountStat label="Extra" value={result.counts.extra} />
      </dl>
    </div>
  )
}

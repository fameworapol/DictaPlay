import type { AlignedWord, ComparisonResult, WordOp } from '../../lib/text-comparison'

const OP_META: Record<WordOp, { symbol: string; label: string; className: string }> = {
  correct: { symbol: '✓', label: 'correct', className: 'border-green-300 bg-green-50 text-green-800' },
  incorrect: { symbol: '≠', label: 'incorrect', className: 'border-red-300 bg-red-50 text-red-800' },
  missing: { symbol: '−', label: 'missing', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  extra: { symbol: '+', label: 'extra', className: 'border-purple-300 bg-purple-50 text-purple-800' },
}

function wordText(word: AlignedWord): string {
  return word.op === 'missing' ? (word.transcriptWord ?? '') : (word.answerWord ?? '')
}

interface ComparisonFeedbackProps {
  transcript: string
  result: ComparisonResult
}

export function ComparisonFeedback({ transcript, result }: ComparisonFeedbackProps) {
  return (
    <div aria-live="polite" className="space-y-4">
      <p className="sr-only">
        Result: {result.counts.correct} correct, {result.counts.incorrect} incorrect,{' '}
        {result.counts.missing} missing, {result.counts.extra} extra.
      </p>

      <div>
        <h3 className="text-sm font-semibold text-slate-600">Correct sentence</h3>
        <p className="mt-1 text-lg">{transcript}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-600">Your answer</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {result.words.map((word, index) => {
            const meta = OP_META[word.op]
            return (
              <li
                key={index}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${meta.className}`}
              >
                <span aria-hidden="true">{meta.symbol}</span>
                <span>{wordText(word)}</span>
                <span className="sr-only">({meta.label})</span>
              </li>
            )
          })}
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <CountStat label="Correct" value={result.counts.correct} />
        <CountStat label="Incorrect" value={result.counts.incorrect} />
        <CountStat label="Missing" value={result.counts.missing} />
        <CountStat label="Extra" value={result.counts.extra} />
      </dl>
    </div>
  )
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-100 p-2 text-center">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  )
}

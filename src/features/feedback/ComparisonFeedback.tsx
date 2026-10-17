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
      <p className="sr-only">Answer revealed.</p>

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

      {!result.isExactMatch && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">💡 Tip: connected speech</p>
          <p className="mt-1">
            In fast, natural English, words often blend together — e.g. "want to" sounds like
            "wanna", "going to" like "gonna", "did you" like "didja". If a word sounded
            different from how it's spelled, try replaying at 0.75x or 0.5x speed to hear the
            parts more clearly.
          </p>
        </div>
      )}
    </div>
  )
}

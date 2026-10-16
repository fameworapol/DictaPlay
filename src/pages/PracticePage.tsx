import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioPlayer'
import { ComparisonFeedback } from '../features/feedback/ComparisonFeedback'
import { DIFFICULTY_LABEL } from '../features/lessons/constants'
import { useLessonData } from '../features/lessons/useLessonData'
import { availableExercisesFor } from '../features/lessons/selectors'
import type { SessionStats } from '../features/practice/types'
import { compareTexts, type ComparisonResult } from '../lib/text-comparison'

export function PracticePage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const state = useLessonData()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [result, setResult] = useState<ComparisonResult | null>(null)

  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]))
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(() => new Set())
  const [exactIndices, setExactIndices] = useState<Set<number>>(() => new Set())
  const [errorTotals, setErrorTotals] = useState({ incorrect: 0, missing: 0, extra: 0 })

  useEffect(() => {
    setVisited((prev) => (prev.has(currentIndex) ? prev : new Set(prev).add(currentIndex)))
  }, [currentIndex])

  if (state.status === 'loading') {
    return <p className="text-slate-600">Loading lesson…</p>
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
        <p className="font-semibold">Couldn't load this lesson.</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </div>
    )
  }

  const lesson = state.lessons.find((l) => l.id === lessonId)
  if (!lesson) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
        <p>Lesson not found.</p>
        <Link to="/library" className="mt-2 inline-block font-medium underline">
          Back to Library
        </Link>
      </div>
    )
  }

  const exercises = availableExercisesFor(lesson, state.exercisesById, state.unavailableExerciseIds)
  if (exercises.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
        <p>This lesson's audio could not be loaded.</p>
        <Link to="/library" className="mt-2 inline-block font-medium underline">
          Back to Library
        </Link>
      </div>
    )
  }

  const exercise = exercises[currentIndex]
  const isLast = currentIndex === exercises.length - 1

  function handleCheck() {
    if (checked) return
    const comparison = compareTexts(exercise.transcript, answer)
    setResult(comparison)
    setChecked(true)
    setCheckedIndices((prev) => new Set(prev).add(currentIndex))
    if (comparison.isExactMatch) {
      setExactIndices((prev) => new Set(prev).add(currentIndex))
    }
    setErrorTotals((prev) => ({
      incorrect: prev.incorrect + comparison.counts.incorrect,
      missing: prev.missing + comparison.counts.missing,
      extra: prev.extra + comparison.counts.extra,
    }))
  }

  function handleClear() {
    setAnswer('')
  }

  function handleRetry() {
    setChecked(false)
    setResult(null)
    setAnswer('')
  }

  function handleNext() {
    if (isLast) {
      const stats: SessionStats = {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        attempted: visited.size,
        completed: checkedIndices.size,
        exactMatches: exactIndices.size,
        errorTotals,
      }
      navigate('/summary', { state: stats })
      return
    }
    setCurrentIndex((i) => i + 1)
    setAnswer('')
    setChecked(false)
    setResult(null)
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      handleCheck()
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{lesson.title}</h1>
        <p className="text-sm text-slate-600">
          {DIFFICULTY_LABEL[lesson.difficulty]} · Question {currentIndex + 1} of {exercises.length}
        </p>
      </div>

      <AudioPlayer src={`/${exercise.audioPath}`} label={`Audio for ${exercise.title}`} />

      <div>
        <label htmlFor="answer" className="block text-sm font-medium text-slate-700">
          Type what you hear
        </label>
        <textarea
          id="answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          disabled={checked}
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 p-3 text-base disabled:bg-slate-100"
          placeholder="Start typing the sentence you heard…"
        />
        <p className="mt-1 text-xs text-slate-500">Tip: press Ctrl/Cmd+Enter to check.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!checked ? (
          <>
            <button
              type="button"
              onClick={handleCheck}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Check
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Clear
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </>
        )}
      </div>

      {checked && result && <ComparisonFeedback transcript={exercise.transcript} result={result} />}
    </div>
  )
}

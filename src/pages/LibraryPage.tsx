import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DIFFICULTY_LABEL } from '../features/lessons/constants'
import { useLessonData } from '../features/lessons/useLessonData'
import { availableExercisesFor } from '../features/lessons/selectors'
import { getAllProgress } from '../lib/storage'
import type { Difficulty } from '../types/lesson'

type DifficultyFilter = 'all' | Difficulty
type SourceFilter = 'all' | 'builtin' | 'custom'
type LessonStatus = 'not_started' | 'in_progress' | 'completed'

const STATUS_LABEL: Record<LessonStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

const STATUS_CLASS: Record<LessonStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
}

export function LibraryPage() {
  const { state } = useLessonData()
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getAllProgress().then((all) => {
      setCompletedExerciseIds(new Set(all.filter((p) => p.completed).map((p) => p.exerciseId)))
    })
  }, [state])

  if (state.status === 'loading') {
    return <p className="text-slate-600">Loading lessons…</p>
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
        <p className="font-semibold">Couldn't load the lesson library.</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </div>
    )
  }

  const { lessons, exercisesById, unavailableExerciseIds } = state

  const withExercises = lessons
    .map((lesson) => ({
      lesson,
      exercises: availableExercisesFor(lesson, exercisesById, unavailableExerciseIds),
      // sourceId is only ever set on sample/demo exercises (see src/types/lesson.ts).
      isSample: lesson.exerciseIds
        .map((id) => exercisesById.get(id))
        .some((e) => Boolean(e?.sourceId)),
    }))
    .filter(({ exercises }) => exercises.length > 0) // hide a lesson whose audio can't load at all
    .filter(({ lesson }) => difficultyFilter === 'all' || lesson.difficulty === difficultyFilter)
    .filter(({ lesson }) => sourceFilter === 'all' || lesson.source === sourceFilter)

  function statusFor(exercises: { id: string }[]): LessonStatus {
    const doneCount = exercises.filter((e) => completedExerciseIds.has(e.id)).length
    if (doneCount === 0) return 'not_started'
    if (doneCount === exercises.length) return 'completed'
    return 'in_progress'
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lesson Library</h1>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Difficulty{' '}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as DifficultyFilter)}
            className="rounded-md border border-slate-300 px-2 py-1"
          >
            <option value="all">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="text-sm">
          Source{' '}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="rounded-md border border-slate-300 px-2 py-1"
          >
            <option value="all">All</option>
            <option value="builtin">Built-in</option>
            <option value="custom">My lessons</option>
          </select>
        </label>
      </div>

      {withExercises.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" role="status">
          No lessons match these filters.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {withExercises.map(({ lesson, exercises, isSample }) => {
            const status = statusFor(exercises)
            return (
              <li key={lesson.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{lesson.title}</h2>
                  <div className="flex gap-1">
                    {isSample && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Sample
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {DIFFICULTY_LABEL[lesson.difficulty]} · {exercises.length}{' '}
                  {exercises.length === 1 ? 'exercise' : 'exercises'}
                  {lesson.source === 'custom' && ' · My lesson'}
                </p>
                <Link
                  to={`/practice/${lesson.id}`}
                  className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Practice
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'
import { DIFFICULTY_LABEL } from '../features/lessons/constants'
import { useLessonData } from '../features/lessons/useLessonData'
import { availableExercisesFor } from '../features/lessons/selectors'

export function LibraryPage() {
  const state = useLessonData()

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
  const visibleLessons = lessons
    .map((lesson) => ({
      lesson,
      exercises: availableExercisesFor(lesson, exercisesById, unavailableExerciseIds),
    }))
    // Hide a lesson entirely if none of its audio could be loaded.
    .filter(({ exercises }) => exercises.length > 0)

  if (visibleLessons.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" role="status">
        No lessons are available right now — their audio could not be loaded.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lesson Library</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {visibleLessons.map(({ lesson, exercises }) => (
          <li key={lesson.id} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{lesson.title}</h2>
              {lesson.source === 'custom' ? null : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Sample
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {DIFFICULTY_LABEL[lesson.difficulty]} · {exercises.length}{' '}
              {exercises.length === 1 ? 'exercise' : 'exercises'}
            </p>
            <Link
              to={`/practice/${lesson.id}`}
              className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Practice
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

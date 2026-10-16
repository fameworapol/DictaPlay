import { Link } from 'react-router-dom'
import { DIFFICULTY_LABEL } from '../features/lessons/constants'
import { useLessonData } from '../features/lessons/useLessonData'
import { availableExercisesFor } from '../features/lessons/selectors'
import type { Difficulty } from '../types/lesson'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const DIFFICULTY_DESCRIPTION: Record<Difficulty, string> = {
  easy: 'Short, everyday sentences.',
  medium: 'Longer sentences with more vocabulary.',
  hard: 'Fast, natural speech from real movies.',
}

export function LibraryPage() {
  const { state } = useLessonData()

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

  const countsByDifficulty = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => {
      const lessonCount = lessons.filter(
        (lesson) =>
          lesson.difficulty === difficulty &&
          availableExercisesFor(lesson, exercisesById, unavailableExerciseIds).length > 0
      ).length
      return [difficulty, lessonCount]
    })
  ) as Record<Difficulty, number>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lesson Library</h1>
      <p className="text-slate-600">Choose a difficulty to see its lessons.</p>

      <ul className="grid gap-4 sm:grid-cols-3">
        {DIFFICULTIES.map((difficulty) => (
          <li key={difficulty}>
            <Link
              to={`/library/${difficulty}`}
              className="block h-full rounded-xl bg-white p-5 shadow-sm hover:shadow-md"
            >
              <h2 className="text-lg font-semibold">{DIFFICULTY_LABEL[difficulty]}</h2>
              <p className="mt-1 text-sm text-slate-600">{DIFFICULTY_DESCRIPTION[difficulty]}</p>
              <p className="mt-3 text-sm font-medium text-brand-700">
                {countsByDifficulty[difficulty]}{' '}
                {countsByDifficulty[difficulty] === 1 ? 'lesson' : 'lessons'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

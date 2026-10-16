import { useEffect, useState, type ReactNode } from 'react'
import { checkAudioAvailable, fetchLessonIndex } from './api'
import { LessonDataContext, type LessonDataState } from './LessonDataContext'

function useLessonDataState(): LessonDataState {
  const [state, setState] = useState<LessonDataState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const index = await fetchLessonIndex()
        const availabilityChecks = await Promise.all(
          index.exercises.map(async (exercise) => ({
            id: exercise.id,
            available: await checkAudioAvailable(exercise.audioPath),
          }))
        )
        if (cancelled) return

        const unavailableExerciseIds = new Set(
          availabilityChecks.filter((c) => !c.available).map((c) => c.id)
        )
        const exercisesById = new Map(index.exercises.map((e) => [e.id, e]))

        setState({ status: 'ready', lessons: index.lessons, exercisesById, unavailableExerciseIds })
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load lessons.',
          })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export function LessonDataProvider({ children }: { children: ReactNode }) {
  const state = useLessonDataState()
  return <LessonDataContext.Provider value={state}>{children}</LessonDataContext.Provider>
}

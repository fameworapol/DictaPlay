import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getAudioBlob, listCustomExercises, listCustomLessons } from '../../lib/storage'
import type { Exercise, Lesson } from '../../types/lesson'
import { checkAudioAvailable, fetchLessonIndex } from './api'
import { LessonDataContext, type LessonDataState } from './LessonDataContext'

async function isExerciseAudioAvailable(exercise: Exercise): Promise<boolean> {
  if (exercise.audioPath) return checkAudioAvailable(exercise.audioPath)
  if (exercise.audioBlobId) return (await getAudioBlob(exercise.audioBlobId)) !== null
  return false
}

function useLessonDataState(): { state: LessonDataState; refresh: () => void } {
  const [state, setState] = useState<LessonDataState>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [index, customLessons, customExercises] = await Promise.all([
          fetchLessonIndex(),
          listCustomLessons(),
          listCustomExercises(),
        ])

        const allLessons: Lesson[] = [...index.lessons, ...customLessons]
        const allExercises: Exercise[] = [...index.exercises, ...customExercises]

        const availabilityChecks = await Promise.all(
          allExercises.map(async (exercise) => ({
            id: exercise.id,
            available: await isExerciseAudioAvailable(exercise),
          }))
        )
        if (cancelled) return

        const unavailableExerciseIds = new Set(
          availabilityChecks.filter((c) => !c.available).map((c) => c.id)
        )
        const exercisesById = new Map(allExercises.map((e) => [e.id, e]))

        setState({ status: 'ready', lessons: allLessons, exercisesById, unavailableExerciseIds })
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
  }, [version])

  return { state, refresh }
}

export function LessonDataProvider({ children }: { children: ReactNode }) {
  const value = useLessonDataState()
  return <LessonDataContext.Provider value={value}>{children}</LessonDataContext.Provider>
}

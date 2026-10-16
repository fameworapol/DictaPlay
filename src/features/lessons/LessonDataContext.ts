import { createContext } from 'react'
import type { Exercise, Lesson } from '../../types/lesson'

export type LessonDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      lessons: Lesson[]
      exercisesById: Map<string, Exercise>
      /** Exercise ids whose audio failed the reachability check. */
      unavailableExerciseIds: Set<string>
    }

export interface LessonDataContextValue {
  state: LessonDataState
  /** Re-fetches the static index and re-reads custom content from storage. */
  refresh: () => void
}

export const LessonDataContext = createContext<LessonDataContextValue | null>(null)

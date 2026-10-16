import { useContext } from 'react'
import { LessonDataContext, type LessonDataState } from './LessonDataContext'

export function useLessonData(): LessonDataState {
  const ctx = useContext(LessonDataContext)
  if (!ctx) throw new Error('useLessonData must be used within a LessonDataProvider')
  return ctx
}

import { useContext } from 'react'
import { LessonDataContext, type LessonDataContextValue } from './LessonDataContext'

export function useLessonData(): LessonDataContextValue {
  const ctx = useContext(LessonDataContext)
  if (!ctx) throw new Error('useLessonData must be used within a LessonDataProvider')
  return ctx
}

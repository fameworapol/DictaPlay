import type { ComparisonCounts } from '../text-comparison'

export interface ExerciseProgress {
  exerciseId: string
  /** Count of Check presses for this exercise, across all sessions. */
  attempts: number
  /** Best fraction correct (0..1) reached across all attempts. */
  bestScore: number
  lastResult: ComparisonCounts & { isExactMatch: boolean }
  /** True after the first Check, not when merely opened. */
  completed: boolean
  lastPracticedAt: number
}

export interface SessionRecord {
  id: string
  lessonId: string
  lessonTitle: string
  startedAt: number
  endedAt: number
  attempted: number
  completed: number
  exactMatches: number
  errorTotals: { incorrect: number; missing: number; extra: number }
  /** Active practice time only (paused while the tab is hidden). */
  activeDurationMs: number
}

export interface AudioBlobRecord {
  id: string
  blob: Blob
  mimeType: string
  createdAt: number
}

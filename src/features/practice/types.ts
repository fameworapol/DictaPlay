export interface SessionStats {
  lessonId: string
  lessonTitle: string
  /** Distinct exercises opened during the session. */
  attempted: number
  /** Distinct exercises where Check was pressed at least once. */
  completed: number
  /** Distinct exercises where an exact match was reached. */
  exactMatches: number
  /** Word-level error totals summed across every Check press in the session. */
  errorTotals: { incorrect: number; missing: number; extra: number }
}

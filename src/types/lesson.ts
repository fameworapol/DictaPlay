export type Difficulty = 'easy' | 'medium' | 'hard'

export type LessonSource = 'builtin' | 'custom'

export interface Lesson {
  id: string
  title: string
  difficulty: Difficulty
  source: LessonSource
  exerciseIds: string[]
}

export interface Exercise {
  id: string
  lessonId: string
  title: string
  difficulty: Difficulty
  /**
   * Relative path under /public. Production (movie-derived, approved) clips
   * live under "audio/built-in/<difficulty>/…"; sample/demo clips live under
   * the separate "audio/sample/<difficulty>/…" and are labeled "Sample" in the UI.
   */
  audioPath: string
  transcript: string
  /** Present for sample/demo content so the UI can label it "Sample". */
  sourceId?: string
}

export interface LessonIndex {
  lessons: Lesson[]
  exercises: Exercise[]
}

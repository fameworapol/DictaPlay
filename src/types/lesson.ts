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
  /** Relative path under /public, e.g. "audio/built-in/easy/ex-001.m4a" */
  audioPath: string
  transcript: string
  /** Present for sample/demo content so the UI can label it "Sample". */
  sourceId?: string
}

export interface LessonIndex {
  lessons: Lesson[]
  exercises: Exercise[]
}

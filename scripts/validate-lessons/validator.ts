import type { Exercise, LessonIndex } from '../../src/types/lesson'

export interface ValidationIssue {
  message: string
}

/**
 * Validates the production lesson index (public/data/lessons-index.json)
 * before it ships:
 *  - every audioPath resolves to a real file
 *  - lesson <-> exercise references are consistent (no dangling ids)
 *  - nothing from audio/sample/ is missing its "Sample" label (sourceId),
 *    and nothing from audio/built-in/ (real production content) carries
 *    one by mistake — either way would mislabel content in the UI.
 */
export function validateProductionIndex(
  index: LessonIndex,
  audioExists: (relativePath: string) => boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const exerciseIds = new Set(index.exercises.map((e) => e.id))
  const lessonIds = new Set(index.lessons.map((l) => l.id))

  for (const lesson of index.lessons) {
    for (const exerciseId of lesson.exerciseIds) {
      if (!exerciseIds.has(exerciseId)) {
        issues.push({ message: `Lesson "${lesson.id}" references missing exercise "${exerciseId}".` })
      }
    }
  }

  for (const exercise of index.exercises) {
    issues.push(...validateExercise(exercise, lessonIds, audioExists))
  }

  return issues
}

function validateExercise(
  exercise: Exercise,
  lessonIds: Set<string>,
  audioExists: (relativePath: string) => boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!lessonIds.has(exercise.lessonId)) {
    issues.push({ message: `Exercise "${exercise.id}" references missing lesson "${exercise.lessonId}".` })
  }

  if (!exercise.audioPath) {
    // Custom (blob-backed) exercises live in IndexedDB, not the static index; this validator only covers the static production index.
    issues.push({ message: `Exercise "${exercise.id}" has no audioPath.` })
    return issues
  }

  if (!audioExists(exercise.audioPath)) {
    issues.push({ message: `Exercise "${exercise.id}" audioPath "${exercise.audioPath}" does not exist.` })
  }

  const isSample = exercise.audioPath.startsWith('audio/sample/')
  const isBuiltin = exercise.audioPath.startsWith('audio/built-in/')

  if (isSample && !exercise.sourceId) {
    issues.push({
      message: `Exercise "${exercise.id}" is under audio/sample/ but has no sourceId, so the UI wouldn't label it "Sample".`,
    })
  }
  if (isBuiltin && exercise.sourceId) {
    issues.push({
      message: `Exercise "${exercise.id}" is production content (audio/built-in/) but has a sourceId, which would mislabel it "Sample".`,
    })
  }

  return issues
}

import type { Exercise, Lesson } from '../../types/lesson'

/** Exercises for a lesson, in the lesson's declared order, with unavailable audio filtered out. */
export function availableExercisesFor(
  lesson: Lesson,
  exercisesById: Map<string, Exercise>,
  unavailableExerciseIds: Set<string>
): Exercise[] {
  const result: Exercise[] = []
  for (const id of lesson.exerciseIds) {
    if (unavailableExerciseIds.has(id)) continue
    const exercise = exercisesById.get(id)
    if (exercise) result.push(exercise)
  }
  return result
}

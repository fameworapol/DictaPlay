import type { Difficulty, Exercise, Lesson } from '../../types/lesson'
import { getDb } from './db'

export async function listCustomLessons(): Promise<Lesson[]> {
  const db = await getDb()
  if (!db) return []
  return db.getAll('customLessons')
}

export async function listCustomExercises(): Promise<Exercise[]> {
  const db = await getDb()
  if (!db) return []
  return db.getAll('customExercises')
}

export async function getCustomLesson(id: string): Promise<Lesson | null> {
  const db = await getDb()
  if (!db) return null
  return (await db.get('customLessons', id)) ?? null
}

export async function createCustomLesson(title: string, difficulty: Difficulty): Promise<Lesson | null> {
  const db = await getDb()
  if (!db) return null
  const lesson: Lesson = {
    id: `custom-lesson-${crypto.randomUUID()}`,
    title,
    difficulty,
    source: 'custom',
    exerciseIds: [],
  }
  await db.put('customLessons', lesson)
  return lesson
}

/** Deletes a lesson and every exercise it contains. Caller is responsible for confirming with the user first. */
export async function deleteCustomLesson(id: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  const lesson = await db.get('customLessons', id)
  if (!lesson) return
  const tx = db.transaction(['customLessons', 'customExercises'], 'readwrite')
  await Promise.all(lesson.exerciseIds.map((exerciseId) => tx.objectStore('customExercises').delete(exerciseId)))
  await tx.objectStore('customLessons').delete(id)
  await tx.done
}

export async function reorderLessonExercises(lessonId: string, exerciseIds: string[]): Promise<void> {
  const db = await getDb()
  if (!db) return
  const lesson = await db.get('customLessons', lessonId)
  if (!lesson) return
  await db.put('customLessons', { ...lesson, exerciseIds })
}

export interface CustomExerciseInput {
  id?: string
  lessonId: string
  title: string
  transcript: string
  difficulty: Difficulty
  audioBlobId: string
}

export async function saveCustomExercise(input: CustomExerciseInput): Promise<Exercise | null> {
  const db = await getDb()
  if (!db) return null

  const id = input.id ?? `custom-ex-${crypto.randomUUID()}`
  const exercise: Exercise = {
    id,
    lessonId: input.lessonId,
    title: input.title,
    transcript: input.transcript,
    difficulty: input.difficulty,
    audioBlobId: input.audioBlobId,
  }

  const tx = db.transaction(['customExercises', 'customLessons'], 'readwrite')
  await tx.objectStore('customExercises').put(exercise)

  if (!input.id) {
    const lesson = await tx.objectStore('customLessons').get(input.lessonId)
    if (lesson && !lesson.exerciseIds.includes(id)) {
      await tx.objectStore('customLessons').put({ ...lesson, exerciseIds: [...lesson.exerciseIds, id] })
    }
  }
  await tx.done

  return exercise
}

/** Deletes an exercise and removes it from its lesson's exercise order. */
export async function deleteCustomExercise(id: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  const exercise = await db.get('customExercises', id)
  if (!exercise) return

  const tx = db.transaction(['customExercises', 'customLessons'], 'readwrite')
  await tx.objectStore('customExercises').delete(id)
  const lesson = await tx.objectStore('customLessons').get(exercise.lessonId)
  if (lesson) {
    await tx.objectStore('customLessons').put({
      ...lesson,
      exerciseIds: lesson.exerciseIds.filter((exerciseId) => exerciseId !== id),
    })
  }
  await tx.done
}

/** Other exercises (besides `excludeExerciseId`, if given) that still use this audio blob. */
export async function exercisesReferencingBlob(
  blobId: string,
  excludeExerciseId?: string
): Promise<Exercise[]> {
  const all = await listCustomExercises()
  return all.filter((e) => e.audioBlobId === blobId && e.id !== excludeExerciseId)
}

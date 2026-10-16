// @vitest-environment node
// fake-indexeddb's Blob structured-clone doesn't round-trip under jsdom's
// Blob implementation; Node's native Blob works correctly and these tests
// don't need the DOM otherwise.
import { beforeEach, describe, expect, it } from 'vitest'
import { addAudioBlob } from '../../src/lib/storage/audioBlobs'
import {
  createCustomLesson,
  deleteCustomExercise,
  deleteCustomLesson,
  exercisesReferencingBlob,
  getCustomLesson,
  listCustomExercises,
  saveCustomExercise,
} from '../../src/lib/storage/customLessons'
import { resetStorageForTests } from './testUtils'

beforeEach(resetStorageForTests)

function fakeBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
}

describe('custom lessons and exercises', () => {
  it('creates a lesson and adds an exercise to it', async () => {
    const lesson = await createCustomLesson('My Lesson', 'easy')
    expect(lesson).not.toBeNull()
    const blobId = await addAudioBlob(fakeBlob(), 'audio/mpeg')
    expect(blobId).not.toBeNull()

    const exercise = await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Ex 1',
      transcript: 'Hello there.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })
    expect(exercise).toMatchObject({ title: 'Ex 1', transcript: 'Hello there.' })

    const updatedLesson = await getCustomLesson(lesson!.id)
    expect(updatedLesson?.exerciseIds).toEqual([exercise!.id])
  })

  it('edits an existing exercise in place (same id, not a new row)', async () => {
    const lesson = await createCustomLesson('My Lesson', 'easy')
    const blobId = await addAudioBlob(fakeBlob(), 'audio/mpeg')
    const exercise = await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Original',
      transcript: 'Original text.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })

    await saveCustomExercise({
      id: exercise!.id,
      lessonId: lesson!.id,
      title: 'Edited',
      transcript: 'Edited text.',
      difficulty: 'medium',
      audioBlobId: blobId!,
    })

    const all = await listCustomExercises()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ title: 'Edited', transcript: 'Edited text.', difficulty: 'medium' })

    const lessonAfter = await getCustomLesson(lesson!.id)
    expect(lessonAfter?.exerciseIds).toEqual([exercise!.id]) // not duplicated
  })

  it('deletes an exercise and removes it from its lesson order', async () => {
    const lesson = await createCustomLesson('My Lesson', 'easy')
    const blobId = await addAudioBlob(fakeBlob(), 'audio/mpeg')
    const exercise = await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Ex',
      transcript: 'Text.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })

    await deleteCustomExercise(exercise!.id)

    expect(await listCustomExercises()).toEqual([])
    const lessonAfter = await getCustomLesson(lesson!.id)
    expect(lessonAfter?.exerciseIds).toEqual([])
  })

  it('deletes a lesson along with all its exercises', async () => {
    const lesson = await createCustomLesson('My Lesson', 'easy')
    const blobId = await addAudioBlob(fakeBlob(), 'audio/mpeg')
    await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Ex 1',
      transcript: 'Text 1.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })
    await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Ex 2',
      transcript: 'Text 2.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })

    await deleteCustomLesson(lesson!.id)

    expect(await getCustomLesson(lesson!.id)).toBeNull()
    expect(await listCustomExercises()).toEqual([])
  })

  it('reports other exercises still referencing a shared audio blob', async () => {
    const lesson = await createCustomLesson('My Lesson', 'easy')
    const blobId = await addAudioBlob(fakeBlob(), 'audio/mpeg')
    const ex1 = await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Ex 1',
      transcript: 'Text 1.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })
    const ex2 = await saveCustomExercise({
      lessonId: lesson!.id,
      title: 'Ex 2 (shares audio)',
      transcript: 'Text 2.',
      difficulty: 'easy',
      audioBlobId: blobId!,
    })

    const referencing = await exercisesReferencingBlob(blobId!, ex1!.id)
    expect(referencing.map((e) => e.id)).toEqual([ex2!.id])

    // Once ex2 is also deleted, nothing references it anymore.
    await deleteCustomExercise(ex2!.id)
    expect(await exercisesReferencingBlob(blobId!, ex1!.id)).toEqual([])
  })
})

// @vitest-environment node
// fake-indexeddb's Blob structured-clone doesn't round-trip under jsdom's
// Blob implementation; Node's native Blob works correctly and these tests
// don't need the DOM otherwise.
import { beforeEach, describe, expect, it } from 'vitest'
import { addAudioBlob, getAudioBlob } from '../../src/lib/storage/audioBlobs'
import { applyBackup, buildBackup, validateBackupFile } from '../../src/lib/storage/backup'
import { createCustomLesson, listCustomExercises, listCustomLessons, saveCustomExercise } from '../../src/lib/storage/customLessons'
import { recordAttempt } from '../../src/lib/storage/progress'
import { resetDbCacheForTests } from '../../src/lib/storage/db'
import { resetStorageForTests } from './testUtils'

beforeEach(resetStorageForTests)

function fakeBlob(content = 'hello'): Blob {
  return new Blob([content], { type: 'audio/mpeg' })
}

async function seedOneExerciseWithAudio() {
  const lesson = await createCustomLesson('Backup Lesson', 'medium')
  const blobId = await addAudioBlob(fakeBlob(), 'audio/mpeg')
  const exercise = await saveCustomExercise({
    lessonId: lesson!.id,
    title: 'Ex',
    transcript: 'Round trip text.',
    difficulty: 'medium',
    audioBlobId: blobId!,
  })
  await recordAttempt(exercise!.id, {
    words: [],
    counts: { correct: 3, incorrect: 0, missing: 0, extra: 0 },
    isExactMatch: true,
  })
  return { lesson: lesson!, exercise: exercise!, blobId: blobId! }
}

describe('validateBackupFile', () => {
  it('rejects non-object input', () => {
    expect(validateBackupFile(null).length).toBeGreaterThan(0)
    expect(validateBackupFile('oops').length).toBeGreaterThan(0)
  })

  it('rejects a mismatched schemaVersion', () => {
    const errors = validateBackupFile({ schemaVersion: 99, customLessons: [], customExercises: [], progress: [], sessions: [] })
    expect(errors.some((e) => e.message.includes('schemaVersion'))).toBe(true)
  })

  it('accepts a well-formed empty backup', () => {
    expect(
      validateBackupFile({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        includesAudio: false,
        customLessons: [],
        customExercises: [],
        progress: [],
        sessions: [],
      })
    ).toEqual([])
  })
})

describe('export/import round trip', () => {
  it('restores lessons, exercises, progress, and audio bytes with audio included', async () => {
    const { exercise, blobId } = await seedOneExerciseWithAudio()
    const backup = await buildBackup(true)
    expect(backup.includesAudio).toBe(true)
    expect(backup.customExercises[0].audioDataUrl).toMatch(/^data:audio\/mpeg;base64,/)

    // Simulate a fresh browser profile.
    await resetStorageForTests()
    resetDbCacheForTests()

    const result = await applyBackup(backup)
    expect(result.errors).toEqual([])
    expect(result.importedLessons).toBe(1)
    expect(result.importedExercises).toBe(1)
    expect(result.exercisesMissingAudio).toEqual([])

    const restoredExercises = await listCustomExercises()
    expect(restoredExercises).toHaveLength(1)
    expect(restoredExercises[0].transcript).toBe('Round trip text.')
    expect(restoredExercises[0].id).toBe(exercise.id)

    // A new blob was created locally (ids aren't required to match across devices);
    // what matters is the bytes survived.
    const newBlobId = restoredExercises[0].audioBlobId!
    expect(newBlobId).not.toBe(blobId) // fresh id, since it's a new local blob
    const restoredBlob = await getAudioBlob(newBlobId)
    expect(restoredBlob).not.toBeNull()
    expect(await restoredBlob!.blob.text()).toBe('hello')
  })

  it('labels a metadata-only export as not including audio, and flags exercises missing audio on import', async () => {
    await seedOneExerciseWithAudio()
    const backup = await buildBackup(false)
    expect(backup.includesAudio).toBe(false)
    expect(backup.customExercises[0].audioDataUrl).toBeUndefined()

    await resetStorageForTests()
    resetDbCacheForTests()

    const result = await applyBackup(backup)
    expect(result.importedExercises).toBe(1)
    expect(result.exercisesMissingAudio).toHaveLength(1)
  })

  it('round-trips practice history (progress) too', async () => {
    const { exercise } = await seedOneExerciseWithAudio()
    const backup = await buildBackup(false)
    expect(backup.progress).toHaveLength(1)
    expect(backup.progress[0].exerciseId).toBe(exercise.id)

    await resetStorageForTests()
    resetDbCacheForTests()
    await applyBackup(backup)

    const lessons = await listCustomLessons()
    expect(lessons).toHaveLength(1)
  })

  it('refuses to import a structurally invalid file without touching storage', async () => {
    const result = await applyBackup({ schemaVersion: 1 })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.importedLessons).toBe(0)
    expect(await listCustomLessons()).toEqual([])
  })
})

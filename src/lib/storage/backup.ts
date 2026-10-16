import type { Exercise, Lesson } from '../../types/lesson'
import { addAudioBlob, getAudioBlob } from './audioBlobs'
import { getDb } from './db'
import { listCustomExercises, listCustomLessons } from './customLessons'
import { getAllProgress } from './progress'
import { getAllSessions } from './sessions'
import type { ExerciseProgress, SessionRecord } from './types'

export const BACKUP_SCHEMA_VERSION = 1

export interface BackupExercise extends Exercise {
  /** Only present when the export included audio: a base64 data URL of the clip. */
  audioDataUrl?: string
}

export interface BackupFile {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  exportedAt: string
  /** Whether audio blobs were embedded. A false export is metadata-only. */
  includesAudio: boolean
  customLessons: Lesson[]
  customExercises: BackupExercise[]
  progress: ExerciseProgress[]
  sessions: SessionRecord[]
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer())
  }
  // Fallback for a Blob-like object that lost its full prototype in transit
  // (observed with a Blob round-tripped through IndexedDB under jsdom in
  // tests); Response can still read it via .stream()/.text().
  const buffer = await new Response(blob as BodyInit).arrayBuffer()
  return new Uint8Array(buffer)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  // Uses raw bytes + btoa() rather than FileReader.readAsDataURL, which
  // fails an internal instanceof check on a Blob retrieved from IndexedDB
  // when it isn't from the exact same Blob constructor FileReader expects.
  const bytes = await readBlobBytes(blob)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${blob.type};base64,${btoa(binary)}`
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid audio data URL.')
  const [, mimeType, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { blob: new Blob([bytes], { type: mimeType }), mimeType }
}

export async function buildBackup(includeAudio: boolean): Promise<BackupFile> {
  const [lessons, exercises, progress, sessions] = await Promise.all([
    listCustomLessons(),
    listCustomExercises(),
    getAllProgress(),
    getAllSessions(),
  ])

  const exportedExercises: BackupExercise[] = await Promise.all(
    exercises.map(async (exercise) => {
      if (!includeAudio || !exercise.audioBlobId) return { ...exercise }
      const record = await getAudioBlob(exercise.audioBlobId)
      if (!record) return { ...exercise }
      const audioDataUrl = await blobToDataUrl(record.blob)
      return { ...exercise, audioDataUrl }
    })
  )

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    includesAudio: includeAudio,
    customLessons: lessons,
    customExercises: exportedExercises,
    progress,
    sessions,
  }
}

export interface BackupValidationError {
  message: string
}

/** Structural validation only — doesn't touch storage. */
export function validateBackupFile(data: unknown): BackupValidationError[] {
  const errors: BackupValidationError[] = []
  if (typeof data !== 'object' || data === null) {
    return [{ message: 'File is not a valid backup (not a JSON object).' }]
  }
  const file = data as Partial<BackupFile>
  if (file.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    errors.push({ message: `Unsupported schemaVersion "${String(file.schemaVersion)}".` })
  }
  if (!Array.isArray(file.customLessons)) errors.push({ message: 'Missing customLessons array.' })
  if (!Array.isArray(file.customExercises)) errors.push({ message: 'Missing customExercises array.' })
  if (!Array.isArray(file.progress)) errors.push({ message: 'Missing progress array.' })
  if (!Array.isArray(file.sessions)) errors.push({ message: 'Missing sessions array.' })
  return errors
}

export interface ImportResult {
  importedLessons: number
  importedExercises: number
  /** Exercises whose audio couldn't be restored (metadata-only export, or the blob was missing). */
  exercisesMissingAudio: string[]
  errors: string[]
}

/**
 * Imports a backup. Custom content always uses the "custom-" id namespace
 * (see customLessons.ts), so this can never overwrite built-in/sample
 * content — those live outside IndexedDB entirely, fetched from the static
 * lesson index. Existing custom records with the same id are overwritten
 * (treated as a restore of this device's own prior export).
 */
export async function applyBackup(data: unknown): Promise<ImportResult> {
  const structuralErrors = validateBackupFile(data)
  if (structuralErrors.length > 0) {
    return {
      importedLessons: 0,
      importedExercises: 0,
      exercisesMissingAudio: [],
      errors: structuralErrors.map((e) => e.message),
    }
  }

  const file = data as BackupFile
  const db = await getDb()
  if (!db) {
    return {
      importedLessons: 0,
      importedExercises: 0,
      exercisesMissingAudio: [],
      errors: ['Storage is unavailable in this browser; nothing was imported.'],
    }
  }

  const exercisesMissingAudio: string[] = []

  for (const lesson of file.customLessons) {
    await db.put('customLessons', lesson)
  }

  for (const exercise of file.customExercises) {
    const { audioDataUrl, ...rest } = exercise
    let audioBlobId = rest.audioBlobId

    if (audioDataUrl) {
      const { blob, mimeType } = dataUrlToBlob(audioDataUrl)
      audioBlobId = (await addAudioBlob(blob, mimeType)) ?? undefined
    } else if (audioBlobId) {
      const existing = await getAudioBlob(audioBlobId)
      if (!existing) exercisesMissingAudio.push(rest.id)
    }

    await db.put('customExercises', { ...rest, audioBlobId })
  }

  for (const record of file.progress) {
    await db.put('attempts', record)
  }
  for (const session of file.sessions) {
    await db.put('sessions', session)
  }

  return {
    importedLessons: file.customLessons.length,
    importedExercises: file.customExercises.length,
    exercisesMissingAudio,
    errors: [],
  }
}

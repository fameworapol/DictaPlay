import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Exercise, Lesson } from '../../types/lesson'
import type { AudioBlobRecord, ExerciseProgress, SessionRecord } from './types'

interface DictationDB extends DBSchema {
  audioBlobs: { key: string; value: AudioBlobRecord }
  customLessons: { key: string; value: Lesson }
  customExercises: { key: string; value: Exercise }
  attempts: { key: string; value: ExerciseProgress }
  sessions: { key: string; value: SessionRecord }
}

const DB_NAME = 'english-dictation'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<DictationDB> | null> | null = null

/**
 * Opens (and memoizes) the IndexedDB database. Never throws: if IndexedDB is
 * unavailable or fails to open, resolves to null so callers can fall back to
 * a non-persistent but still-usable app, per the project's hard constraint
 * that the app must keep working without persistence.
 */
export function getDb(): Promise<IDBPDatabase<DictationDB> | null> {
  if (!dbPromise) {
    dbPromise = openDB<DictationDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('customLessons')) {
          db.createObjectStore('customLessons', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('customExercises')) {
          db.createObjectStore('customExercises', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('attempts')) {
          db.createObjectStore('attempts', { keyPath: 'exerciseId' })
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
      },
    }).catch((error: unknown) => {
      console.warn('[storage] IndexedDB unavailable; continuing without persistence.', error)
      return null
    })
  }
  return dbPromise
}

/** Test-only: forces the next getDb() call to re-open the database from scratch. */
export function resetDbCacheForTests(): void {
  dbPromise = null
}

import { getDb } from './db'
import type { AudioBlobRecord } from './types'

export async function addAudioBlob(blob: Blob, mimeType: string): Promise<string | null> {
  const db = await getDb()
  if (!db) return null
  const id = `custom-audio-${crypto.randomUUID()}`
  await db.put('audioBlobs', { id, blob, mimeType, createdAt: Date.now() })
  return id
}

export async function getAudioBlob(id: string): Promise<AudioBlobRecord | null> {
  const db = await getDb()
  if (!db) return null
  return (await db.get('audioBlobs', id)) ?? null
}

export async function deleteAudioBlob(id: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  await db.delete('audioBlobs', id)
}

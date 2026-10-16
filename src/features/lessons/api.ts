import type { LessonIndex } from '../../types/lesson'

/**
 * Fetches the lesson index at runtime (not bundled into the JS bundle), so the
 * production index can be regenerated/exported without a rebuild of the app shell.
 */
export async function fetchLessonIndex(): Promise<LessonIndex> {
  const res = await fetch('/data/lessons-index.json')
  if (!res.ok) {
    throw new Error(`Failed to load lesson index (HTTP ${res.status})`)
  }
  return (await res.json()) as LessonIndex
}

/** Cheap existence check so a lesson can be hidden if its audio can't be fetched. */
export async function checkAudioAvailable(audioPath: string): Promise<boolean> {
  try {
    const res = await fetch(`/${audioPath}`, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

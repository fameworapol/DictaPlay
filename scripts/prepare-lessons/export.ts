import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Exercise, Lesson } from '../../src/types/lesson'
import type { CandidateClip } from './types'

/**
 * Grouping rule (documented per spec): approved clips are grouped by their
 * source movie, ordered chronologically by start time, and chunked into
 * lessons of up to LESSON_SIZE exercises each so a lesson roughly follows
 * the movie's own scene order.
 */
const LESSON_SIZE = 8

function titleCase(id: string): string {
  return id.replace(/[_-]+/g, ' ').trim()
}

export interface GroupedLessons {
  lessons: Lesson[]
  exercises: Exercise[]
}

export function groupIntoLessons(candidates: CandidateClip[]): GroupedLessons {
  const approved = candidates.filter((c) => c.status === 'approved')

  const bySource = new Map<string, CandidateClip[]>()
  for (const candidate of approved) {
    const list = bySource.get(candidate.source) ?? []
    list.push(candidate)
    bySource.set(candidate.source, list)
  }

  const lessons: Lesson[] = []
  const exercises: Exercise[] = []

  for (const [source, clips] of bySource) {
    const sorted = [...clips].sort((a, b) => a.start - b.start)
    const chunkCount = Math.ceil(sorted.length / LESSON_SIZE)

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const chunk = sorted.slice(chunkIndex * LESSON_SIZE, (chunkIndex + 1) * LESSON_SIZE)
      const lessonId = `${source}-lesson-${chunkIndex + 1}`
      const difficulty = chunk[0].difficulty

      lessons.push({
        id: lessonId,
        title: `${titleCase(source)} — Part ${chunkIndex + 1}`,
        difficulty,
        source: 'builtin',
        exerciseIds: chunk.map((c) => c.id),
      })

      chunk.forEach((candidate, i) => {
        exercises.push({
          id: candidate.id,
          lessonId,
          title: `${titleCase(source)} #${chunkIndex * LESSON_SIZE + i + 1}`,
          difficulty: candidate.difficulty,
          audioPath: `audio/built-in/${candidate.difficulty}/${candidate.id}.m4a`,
          transcript: candidate.text,
          // sourceId is reserved for flagging sample/demo content in the UI
          // (see src/types/lesson.ts); production clips leave it unset.
        })
      })
    }
  }

  return { lessons, exercises }
}

export interface ExportResult extends GroupedLessons {
  totalBytes: number
  copiedFiles: string[]
}

/**
 * Copies only approved clips' audio into the production folder and returns
 * the lesson/exercise index to write alongside it. Callers must run
 * `validateApprovedCandidates` first and refuse to export on any issue.
 */
export async function exportApprovedClips(
  candidates: CandidateClip[],
  clipPath: (candidate: CandidateClip) => string,
  publicAudioDir: string
): Promise<ExportResult> {
  const grouped = groupIntoLessons(candidates)
  const approvedById = new Map(
    candidates.filter((c) => c.status === 'approved').map((c) => [c.id, c])
  )

  let totalBytes = 0
  const copiedFiles: string[] = []

  for (const exercise of grouped.exercises) {
    const candidate = approvedById.get(exercise.id)
    if (!candidate) continue

    const src = clipPath(candidate)
    const dest = `${publicAudioDir}/${candidate.difficulty}/${candidate.id}.m4a`
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
    const { size } = await stat(dest)
    totalBytes += size
    copiedFiles.push(dest)
  }

  return { ...grouped, totalBytes, copiedFiles }
}

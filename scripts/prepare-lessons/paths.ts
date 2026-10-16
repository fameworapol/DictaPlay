import { fileURLToPath } from 'node:url'
import type { CandidateClip } from './types'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

export function workdirRoot(workdir: string): string {
  return workdir
}

export function sourceDir(workdir: string, source: string): string {
  return `${workdir}/${source}`
}

export function sourceAudioPath(workdir: string, source: string): string {
  return `${sourceDir(workdir, source)}/audio.wav`
}

export function sourceSubsPath(workdir: string, source: string): string {
  return `${sourceDir(workdir, source)}/subs.srt`
}

export function candidatesJsonPath(workdir: string): string {
  return `${workdir}/candidates.json`
}

/** Where a candidate's cut clip lives in the working directory, by convention. */
export function candidateClipPath(workdir: string, candidate: CandidateClip): string {
  return `${sourceDir(workdir, candidate.source)}/candidates/${candidate.difficulty}/${candidate.id}.m4a`
}

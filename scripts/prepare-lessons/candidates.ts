import { readFile, writeFile } from 'node:fs/promises'
import type { CandidateClip, CandidateFlag, CandidatesFile } from './types'

export function candidatesPathFor(workdir: string): string {
  return `${workdir}/candidates.json`
}

export async function readCandidates(path: string): Promise<CandidatesFile> {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as CandidatesFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { schemaVersion: 1, candidates: [] }
    }
    throw error
  }
}

export async function writeCandidates(path: string, file: CandidatesFile): Promise<void> {
  await writeFile(path, JSON.stringify(file, null, 2) + '\n', 'utf-8')
}

export function clipId(source: string, difficulty: string, sequence: number): string {
  const padded = String(sequence).padStart(3, '0')
  return `${source}-${difficulty}-${padded}`
}

export interface PartitionByFlagResult {
  toRemove: CandidateClip[]
  toKeep: CandidateClip[]
}

/** Pure split of candidates into those carrying `flag` (optionally scoped to one source) and the rest. */
export function partitionCandidatesByFlag(
  candidates: CandidateClip[],
  flag: CandidateFlag,
  source?: string
): PartitionByFlagResult {
  const toRemove: CandidateClip[] = []
  const toKeep: CandidateClip[] = []
  for (const candidate of candidates) {
    const matches = candidate.flags.includes(flag) && (!source || candidate.source === source)
    ;(matches ? toRemove : toKeep).push(candidate)
  }
  return { toRemove, toKeep }
}

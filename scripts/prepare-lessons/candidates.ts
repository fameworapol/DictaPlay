import { readFile, writeFile } from 'node:fs/promises'
import type { CandidatesFile } from './types'

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

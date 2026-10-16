import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { candidatesPathFor, clipId, readCandidates, writeCandidates } from './candidates'
import { exportApprovedClips } from './export'
import { cutClip, detectSilenceDurations, extractAudioTrack, extractSubtitleTrack, inspectMedia } from './ffmpeg'
import { detectSegmentFlags, findDuplicateTextIndices } from './flags'
import {
  candidateClipPath,
  projectRoot,
  sourceAudioPath,
  sourceDir,
  sourceSubsPath,
} from './paths'
import { buildSentenceSegments, groupIntoClips } from './segment'
import { parseSrt } from './srt'
import { whisperCliProvider } from './transcribe'
import type { CandidateClip, Difficulty } from './types'
import { validateApprovedCandidates } from './validate'

export async function inspectCommand(mkvPath: string): Promise<void> {
  const streams = await inspectMedia(mkvPath)
  console.log(`Streams in ${mkvPath}:`)
  for (const s of streams) {
    const details = [s.language && `lang=${s.language}`, s.title && `title="${s.title}"`]
      .filter(Boolean)
      .join(' ')
    console.log(`  #${s.index} ${s.codecType.padEnd(8)} ${s.codecName.padEnd(10)} ${details}`)
  }
}

export async function extractAudioCommand(
  mkvPath: string,
  source: string,
  streamIndex: number,
  workdir: string
): Promise<void> {
  await mkdir(sourceDir(workdir, source), { recursive: true })
  const outPath = sourceAudioPath(workdir, source)
  await extractAudioTrack(mkvPath, streamIndex, outPath)
  console.log(`Extracted audio track #${streamIndex} -> ${outPath}`)
}

export async function extractSubsCommand(
  mkvPath: string | null,
  source: string,
  workdir: string,
  options: { streamIndex?: number; fromSrtPath?: string }
): Promise<void> {
  await mkdir(sourceDir(workdir, source), { recursive: true })
  const outPath = sourceSubsPath(workdir, source)

  if (options.fromSrtPath) {
    await copyFile(options.fromSrtPath, outPath)
    console.log(`Copied external subtitles ${options.fromSrtPath} -> ${outPath}`)
    return
  }

  if (!mkvPath || options.streamIndex === undefined) {
    throw new Error('extract-subs needs either --from <external.srt> or an mkv path with --stream <index>')
  }
  const srt = await extractSubtitleTrack(mkvPath, options.streamIndex)
  await writeFile(outPath, srt, 'utf-8')
  console.log(`Extracted subtitle track #${options.streamIndex} -> ${outPath}`)
}

export async function transcribeCommand(source: string, workdir: string): Promise<void> {
  const audioPath = sourceAudioPath(workdir, source)
  if (!existsSync(audioPath)) {
    throw new Error(`No extracted audio found at ${audioPath}. Run extract-audio first.`)
  }
  const available = await whisperCliProvider.isAvailable()
  if (!available) {
    throw new Error(
      `${whisperCliProvider.name} is not installed, so transcription cannot run. ` +
        'This step is never simulated — install it, or use extract-subs with real subtitles instead.'
    )
  }
  const cues = await whisperCliProvider.transcribe(audioPath)
  const srtPath = sourceSubsPath(workdir, source)
  const srtText = cues
    .map(
      (c, i) =>
        `${i + 1}\n${formatTimecode(c.start)} --> ${formatTimecode(c.end)}\n${c.text}\n`
    )
    .join('\n')
  await writeFile(srtPath, srtText, 'utf-8')
  console.log(`Transcribed ${cues.length} cues -> ${srtPath}`)
}

function formatTimecode(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

export async function segmentCommand(
  source: string,
  difficulty: Difficulty,
  workdir: string,
  options: { force?: boolean; targetSeconds?: number } = {}
): Promise<void> {
  const subsPath = sourceSubsPath(workdir, source)
  if (!existsSync(subsPath)) {
    throw new Error(`No subtitles found at ${subsPath}. Run extract-subs or transcribe first.`)
  }
  const srtContent = await readFile(subsPath, 'utf-8')
  const cues = parseSrt(srtContent)
  const sentences = buildSentenceSegments(cues)
  // Group whole sentences into ~targetSeconds clips (default 10s) instead of
  // one sentence per clip, so each exercise is a fuller stretch of dialogue.
  // Pass --target-seconds 0 to fall back to one sentence per clip.
  const targetSeconds = options.targetSeconds ?? 10
  const segments = targetSeconds > 0 ? groupIntoClips(sentences, targetSeconds) : sentences

  const candidatesFile = await readCandidates(candidatesPathFor(workdir))
  const existingForSource = candidatesFile.candidates.filter((c) => c.source === source)
  if (existingForSource.length > 0 && !options.force) {
    throw new Error(
      `${existingForSource.length} candidate(s) already exist for source "${source}". ` +
        're-running segment would discard any review progress. Pass --force to regenerate anyway.'
    )
  }

  const duplicateIndices = findDuplicateTextIndices(segments.map((s) => s.text))

  const newCandidates: CandidateClip[] = segments.map((segment, i) => {
    const flags = detectSegmentFlags(segment)
    if (duplicateIndices.has(i)) flags.push('duplicated_text')
    return {
      id: clipId(source, difficulty, i + 1),
      source,
      difficulty,
      start: segment.start,
      end: segment.end,
      text: segment.text,
      status: 'pending',
      flags,
    }
  })

  const keep = candidatesFile.candidates.filter((c) => c.source !== source)
  await writeCandidates(candidatesPathFor(workdir), {
    schemaVersion: 1,
    candidates: [...keep, ...newCandidates],
  })
  console.log(`Segmented ${segments.length} candidate sentences for "${source}" (${difficulty}).`)
}

export async function cutCommand(source: string, workdir: string): Promise<void> {
  const candidatesFile = await readCandidates(candidatesPathFor(workdir))
  const forSource = candidatesFile.candidates.filter((c) => c.source === source)
  if (forSource.length === 0) {
    throw new Error(`No candidates found for source "${source}". Run segment first.`)
  }

  const audioPath = sourceAudioPath(workdir, source)
  if (!existsSync(audioPath)) {
    throw new Error(`No extracted audio found at ${audioPath}. Run extract-audio first.`)
  }

  let cutCount = 0
  for (const candidate of candidatesFile.candidates) {
    if (candidate.source !== source) continue
    const outPath = candidateClipPath(workdir, candidate)
    await mkdir(outPath.slice(0, outPath.lastIndexOf('/')), { recursive: true })

    candidate.flags = candidate.flags.filter((f) => f !== 'missing_audio' && f !== 'long_silence')

    if (candidate.start < 0 || candidate.end <= candidate.start) {
      if (!candidate.flags.includes('invalid_range')) candidate.flags.push('invalid_range')
      continue // can't cut an invalid range
    }

    await cutClip({
      sourceWavPath: audioPath,
      start: candidate.start,
      end: candidate.end,
      paddingSeconds: 0.3,
      outPath,
    })
    cutCount++

    const silences = await detectSilenceDurations(outPath)
    if (silences.some((d) => d >= 1.5)) {
      candidate.flags.push('long_silence')
    }
  }

  await writeCandidates(candidatesPathFor(workdir), candidatesFile)
  console.log(`Cut ${cutCount} clip(s) for "${source}".`)
}

export async function validateCommand(workdir: string): Promise<boolean> {
  const candidatesFile = await readCandidates(candidatesPathFor(workdir))
  const issues = validateApprovedCandidates(candidatesFile.candidates, (c) =>
    existsSync(candidateClipPath(workdir, c))
  )

  const approvedCount = candidatesFile.candidates.filter((c) => c.status === 'approved').length
  console.log(`${approvedCount} clip(s) marked approved.`)

  if (issues.length === 0) {
    console.log('Validation passed: every approved clip has no unresolved flags and its audio exists.')
    return true
  }

  console.error(`Validation failed with ${issues.length} issue(s):`)
  for (const issue of issues) {
    console.error(`  - ${issue.candidateId}: ${issue.reason}`)
  }
  return false
}

export async function exportCommand(
  workdir: string,
  publicAudioDir: string,
  lessonsIndexPath: string,
  budgetMb: number
): Promise<void> {
  const ok = await validateCommand(workdir)
  if (!ok) {
    throw new Error('Refusing to export: validation failed. Fix the issues above first.')
  }

  const candidatesFile = await readCandidates(candidatesPathFor(workdir))
  const approvedCount = candidatesFile.candidates.filter((c) => c.status === 'approved').length
  if (approvedCount === 0) {
    console.log('No approved clips to export. Nothing to do.')
    return
  }

  const result = await exportApprovedClips(
    candidatesFile.candidates,
    (candidate) => candidateClipPath(workdir, candidate),
    publicAudioDir
  )

  const existingIndexRaw = existsSync(lessonsIndexPath)
    ? JSON.parse(await readFile(lessonsIndexPath, 'utf-8'))
    : { lessons: [], exercises: [] }

  const newLessonIds = new Set(result.lessons.map((l) => l.id))
  const newExerciseIds = new Set(result.exercises.map((e) => e.id))

  const mergedLessons = [
    ...existingIndexRaw.lessons.filter((l: { id: string }) => !newLessonIds.has(l.id)),
    ...result.lessons,
  ]
  const mergedExercises = [
    ...existingIndexRaw.exercises.filter((e: { id: string }) => !newExerciseIds.has(e.id)),
    ...result.exercises,
  ]

  await writeFile(
    lessonsIndexPath,
    JSON.stringify({ lessons: mergedLessons, exercises: mergedExercises }, null, 2) + '\n',
    'utf-8'
  )

  const totalMb = result.totalBytes / (1024 * 1024)
  console.log(`Exported ${result.copiedFiles.length} clip(s), ${totalMb.toFixed(2)} MB total.`)
  console.log(`Wrote ${result.lessons.length} lesson(s) / ${result.exercises.length} exercise(s) to ${lessonsIndexPath}`)
  if (totalMb > budgetMb) {
    console.warn(
      `Warning: exported audio is ${totalMb.toFixed(2)} MB, over the configured budget of ${budgetMb} MB.`
    )
  }
}

export function deriveSourceId(mkvPath: string): string {
  return basename(mkvPath).replace(/\.[^.]+$/, '')
}

export { projectRoot }

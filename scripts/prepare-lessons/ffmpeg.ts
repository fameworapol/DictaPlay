import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface MediaStreamInfo {
  index: number
  codecType: 'video' | 'audio' | 'subtitle' | string
  codecName: string
  language?: string
  title?: string
}

function assertOnPath(bin: 'ffmpeg' | 'ffprobe'): void {
  try {
    execFileSync(bin, ['-version'], { stdio: 'ignore' })
  } catch {
    throw new Error(
      `${bin} was not found on PATH. Install FFmpeg (e.g. \`brew install ffmpeg\` on macOS) and re-run.`
    )
  }
}

/** Lists audio/subtitle/video streams in a media file via ffprobe. Never fabricates results. */
export async function inspectMedia(filePath: string): Promise<MediaStreamInfo[]> {
  assertOnPath('ffprobe')
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    filePath,
  ])
  const parsed = JSON.parse(stdout) as {
    streams: Array<{
      index: number
      codec_type: string
      codec_name: string
      tags?: Record<string, string>
    }>
  }
  return parsed.streams.map((s) => ({
    index: s.index,
    codecType: s.codec_type,
    codecName: s.codec_name,
    language: s.tags?.language,
    title: s.tags?.title,
  }))
}

/** Extracts one audio stream to a single lossless WAV file for fast, accurate repeated cutting. */
export async function extractAudioTrack(
  mkvPath: string,
  streamIndex: number,
  outWavPath: string
): Promise<void> {
  assertOnPath('ffmpeg')
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    mkvPath,
    '-map',
    `0:${streamIndex}`,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-acodec',
    'pcm_s16le',
    outWavPath,
  ])
}

/** Extracts an embedded SRT-compatible subtitle stream as plain .srt text. */
export async function extractSubtitleTrack(mkvPath: string, streamIndex: number): Promise<string> {
  assertOnPath('ffmpeg')
  const { stdout } = await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    mkvPath,
    '-map',
    `0:${streamIndex}`,
    '-f',
    'srt',
    'pipe:1',
  ])
  return stdout
}

export interface CutOptions {
  sourceWavPath: string
  start: number
  end: number
  /** Extra padding in seconds added on both sides of the cut, clamped to >= 0. */
  paddingSeconds: number
  outPath: string
  bitrateKbps?: number
}

/** Cuts and encodes one mono clip (AAC/M4A, ~64kbps by default) from the extracted source WAV. */
export async function cutClip(options: CutOptions): Promise<void> {
  assertOnPath('ffmpeg')
  const paddedStart = Math.max(0, options.start - options.paddingSeconds)
  const duration = options.end - options.start + 2 * options.paddingSeconds
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    paddedStart.toFixed(3),
    '-t',
    Math.max(duration, 0.1).toFixed(3),
    '-i',
    options.sourceWavPath,
    '-ac',
    '1',
    '-c:a',
    'aac',
    '-b:a',
    `${options.bitrateKbps ?? 64}k`,
    options.outPath,
  ])
}

/**
 * Returns the durations (seconds) of any silent spans in the clip at least
 * 0.3s long, using ffmpeg's silencedetect filter (real audio analysis, read
 * from stderr — the filter always exits 0, so this never throws on "found").
 */
export async function detectSilenceDurations(clipPath: string, noiseDb = -35): Promise<number[]> {
  assertOnPath('ffmpeg')
  let stderr = ''
  try {
    const result = await execFileAsync(
      'ffmpeg',
      ['-i', clipPath, '-af', `silencedetect=noise=${noiseDb}dB:d=0.3`, '-f', 'null', '-'],
      { maxBuffer: 1024 * 1024 * 16 }
    )
    stderr = result.stderr
  } catch (error) {
    stderr = (error as { stderr?: string }).stderr ?? ''
  }
  const durations: number[] = []
  const re = /silence_duration:\s*([\d.]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(stderr))) {
    durations.push(Number(match[1]))
  }
  return durations
}

import { execFile, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { parseSrt } from './srt'
import type { SrtCue } from './types'

const execFileAsync = promisify(execFile)

/**
 * A speech-to-text provider turns an audio file into timed cues, in the same
 * shape the SRT parser produces, so `segment` can treat STT and real
 * subtitles identically. Providers must never fabricate output: if the
 * underlying tool isn't installed, `transcribe` throws a clear error instead
 * of returning placeholder text.
 */
export interface SttProvider {
  readonly name: string
  isAvailable(): Promise<boolean>
  transcribe(audioPath: string): Promise<SrtCue[]>
}

/**
 * Shells out to the local `whisper` CLI (the openai-whisper Python package;
 * `pip install -U openai-whisper`). Chosen as the default documented
 * provider because it ships a real CLI with SRT output out of the box.
 * Never runs on Vercel and never uploads audio anywhere — it's a local
 * subprocess only.
 */
export const whisperCliProvider: SttProvider = {
  name: 'whisper (openai-whisper CLI)',

  async isAvailable() {
    try {
      execFileSync('whisper', ['--help'], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  },

  async transcribe(audioPath: string): Promise<SrtCue[]> {
    const available = await this.isAvailable()
    if (!available) {
      throw new Error(
        'whisper CLI is not installed. Install it with `pip install -U openai-whisper` ' +
          '(requires Python) or provide an external .srt file with --subs instead. ' +
          'This step is never simulated.'
      )
    }

    const outDir = await mkdtemp(join(tmpdir(), 'dictation-whisper-'))
    try {
      await execFileAsync(
        'whisper',
        [audioPath, '--model', 'base', '--language', 'English', '--output_format', 'srt', '--output_dir', outDir],
        { maxBuffer: 1024 * 1024 * 64 }
      )
      const stem = audioPath.split('/').pop()!.replace(/\.[^.]+$/, '')
      const srtPath = join(outDir, `${stem}.srt`)
      const srtContent = await readFile(srtPath, 'utf-8')
      return parseSrt(srtContent)
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  },
}

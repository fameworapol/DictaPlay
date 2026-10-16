import type { SrtCue } from './types'

const TIMECODE_RE =
  /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/

function timecodeToSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
}

/** Strips SRT/ASS-style markup (<i>, <b>, <font ...>, {\an8}) from a line of subtitle text. */
function stripMarkup(line: string): string {
  return line
    .replace(/\{[^}]*\}/g, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .trim()
}

/**
 * Parses SRT subtitle content into timed cues. Tolerant of CRLF line endings,
 * a leading BOM, missing/non-sequential index lines, and blank subtitle text.
 * Pure function; never throws on malformed individual blocks (they're skipped).
 */
export function parseSrt(content: string): SrtCue[] {
  const withoutBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const normalized = withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.split(/\n\s*\n/)

  const cues: SrtCue[] = []
  let fallbackIndex = 1

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.length > 0)
    if (lines.length === 0) continue

    let lineIndex = 0
    let explicitIndex: number | null = null

    if (/^\d+$/.test(lines[0].trim())) {
      explicitIndex = Number(lines[0].trim())
      lineIndex = 1
    }

    const timecodeLine = lines[lineIndex]
    if (!timecodeLine) continue
    const match = TIMECODE_RE.exec(timecodeLine)
    if (!match) continue

    const start = timecodeToSeconds(match[1], match[2], match[3], match[4])
    const end = timecodeToSeconds(match[5], match[6], match[7], match[8])

    const textLines = lines.slice(lineIndex + 1).map(stripMarkup).filter((l) => l.length > 0)
    const text = textLines.join(' ').replace(/\s+/g, ' ').trim()

    cues.push({ index: explicitIndex ?? fallbackIndex, start, end, text })
    fallbackIndex++
  }

  return cues
}

import type { SrtCue } from './types'

export interface SentenceSegment {
  start: number
  end: number
  text: string
  /** Original cue indices this segment was built from, for traceability. */
  cueIndices: number[]
}

const SENTENCE_END_RE = /[.!?]["')\]]*$/

/**
 * Builds candidate sentence segments from subtitle cues.
 * - A cue fragment lacking sentence-ending punctuation is merged with
 *   subsequent cues until a sentence boundary is found (fixes fragments split
 *   across multiple subtitle cards).
 * - A merged block containing several sentences is split on sentence
 *   boundaries. We only have cue-level timestamps, so time is distributed
 *   across split sentences in proportion to character length — a documented
 *   approximation, not a real measurement.
 * - No duration/word-count limits are enforced here; the caller applies flags.
 */
export function buildSentenceSegments(cues: SrtCue[]): SentenceSegment[] {
  const segments: SentenceSegment[] = []

  let bufferText = ''
  let bufferStart: number | null = null
  let bufferEnd = 0
  let bufferCueIndices: number[] = []

  function flushBuffer() {
    if (bufferStart === null || bufferText.trim().length === 0) {
      bufferText = ''
      bufferStart = null
      bufferCueIndices = []
      return
    }
    const start = bufferStart
    const end = bufferEnd
    const sentences = splitIntoSentences(bufferText)
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1
    const duration = end - start

    let cursor = start
    sentences.forEach((sentence, i) => {
      const isLast = i === sentences.length - 1
      const share = sentence.length / totalChars
      const segStart = cursor
      const segEnd = isLast ? end : cursor + duration * share
      segments.push({ start: segStart, end: segEnd, text: sentence, cueIndices: [...bufferCueIndices] })
      cursor = segEnd
    })

    bufferText = ''
    bufferStart = null
    bufferCueIndices = []
  }

  for (const cue of cues) {
    if (cue.text.trim().length === 0) continue
    if (bufferStart === null) bufferStart = cue.start
    bufferEnd = cue.end
    bufferCueIndices.push(cue.index)
    bufferText = bufferText.length > 0 ? `${bufferText} ${cue.text}` : cue.text

    if (SENTENCE_END_RE.test(cue.text.trim())) {
      flushBuffer()
    }
  }
  flushBuffer() // trailing fragment with no terminal punctuation is still kept as a candidate

  return segments
}

function splitIntoSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?]["')\]]?)\s+(?=[A-Z0-9"'])/)
  return parts.map((p) => p.trim()).filter((p) => p.length > 0)
}

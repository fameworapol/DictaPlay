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
 * A fragment missing terminal punctuation only keeps buffering across a gap
 * this small. Without this cap, a line that never ends in ./!/? — a song
 * lyric (often written with ♪ instead of a period), a stray watermark line,
 * an OCR glitch — would keep absorbing every cue after it, including ones
 * minutes later, while hunting for the next period. Real fragments of one
 * spoken sentence are adjacent in time; this just stops the search once
 * that stops being plausible, and flushes whatever's buffered as-is.
 */
const MAX_FRAGMENT_GAP_SECONDS = 2

/**
 * Backstop for content that never produces terminal punctuation at all —
 * song lyrics are the common case (each line is its own cue, often written
 * with ♪ instead of a period, and lines follow each other closely enough
 * that the gap cap above never kicks in). Once a buffered fragment would
 * reach this long, it's flushed as-is rather than kept open indefinitely.
 * This is a correctness backstop, not a target length — see groupIntoClips
 * below for the actual ~10s clip-length policy applied after sentences are
 * built.
 */
const MAX_FRAGMENT_DURATION_SECONDS = 15

/**
 * Builds candidate sentence segments from subtitle cues.
 * - A cue fragment lacking sentence-ending punctuation is merged with
 *   subsequent cues until a sentence boundary is found (fixes fragments split
 *   across multiple subtitle cards), but never across a gap bigger than
 *   MAX_FRAGMENT_GAP_SECONDS, and never past MAX_FRAGMENT_DURATION_SECONDS
 *   total (see above — covers content with no terminal punctuation at all).
 * - A merged block containing several sentences is split on sentence
 *   boundaries. We only have cue-level timestamps, so time is distributed
 *   across split sentences in proportion to character length — a documented
 *   approximation, not a real measurement.
 * - No other duration/word-count limits are enforced here; the caller
 *   applies flags for pacing/length instead of rejecting outright.
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

    const gapTooLarge = bufferStart !== null && cue.start - bufferEnd > MAX_FRAGMENT_GAP_SECONDS
    const wouldExceedMaxDuration =
      bufferStart !== null && cue.end - bufferStart > MAX_FRAGMENT_DURATION_SECONDS
    if (gapTooLarge || wouldExceedMaxDuration) {
      flushBuffer()
    }

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

/**
 * Groups consecutive sentence segments into clips around `targetSeconds`
 * long (default 10s), so an exercise is a few sentences of real dialogue
 * rather than a single short line. Never cuts a sentence in half — it only
 * merges whole sentences.
 *
 * Greedy left-to-right: keep appending the next sentence while the group is
 * still under `targetSeconds` and the merge wouldn't exceed `maxSeconds`.
 * Stops merging across a gap bigger than `maxGapSeconds` (e.g. a scene
 * change) so a clip doesn't span a long silent stretch just to hit the
 * target duration.
 */
export function groupIntoClips(
  segments: SentenceSegment[],
  targetSeconds = 10,
  maxSeconds = 15,
  maxGapSeconds = 3
): SentenceSegment[] {
  const groups: SentenceSegment[] = []
  let current: SentenceSegment | null = null

  for (const segment of segments) {
    if (!current) {
      current = { ...segment, cueIndices: [...segment.cueIndices] }
      continue
    }

    const gap = segment.start - current.end
    const currentDuration = current.end - current.start
    const mergedDuration = segment.end - current.start

    if (currentDuration >= targetSeconds || gap > maxGapSeconds || mergedDuration > maxSeconds) {
      groups.push(current)
      current = { ...segment, cueIndices: [...segment.cueIndices] }
      continue
    }

    current = {
      start: current.start,
      end: segment.end,
      text: `${current.text} ${segment.text}`,
      cueIndices: [...current.cueIndices, ...segment.cueIndices],
    }
  }

  if (current) groups.push(current)
  return groups
}

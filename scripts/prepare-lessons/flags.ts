import type { CandidateFlag } from './types'

/** Faster than ~240 words/minute in a clip is not realistic spoken-English pacing. */
const MAX_WORDS_PER_SECOND = 4
const SUSPICIOUSLY_LONG_SENTENCE_WORDS = 40

export interface FlaggableSegment {
  text: string
  start: number
  end: number
}

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length
}

/**
 * Flags derivable from a single segment's text and timing alone. Flags that
 * need the cut audio file (missing_audio, long_silence) or cross-segment
 * context (duplicated_text) are computed separately.
 */
export function detectSegmentFlags(segment: FlaggableSegment): CandidateFlag[] {
  const flags: CandidateFlag[] = []
  const text = segment.text.trim()
  const duration = segment.end - segment.start

  if (text.length === 0) {
    flags.push('empty_transcript')
  }
  if (!(segment.start >= 0) || !(segment.end > segment.start)) {
    flags.push('invalid_range')
  }
  if (text.length > 0 && duration > 0) {
    const words = wordCount(text)
    if (words / duration > MAX_WORDS_PER_SECOND) {
      flags.push('too_short_for_word_count')
    }
    if (words > SUSPICIOUSLY_LONG_SENTENCE_WORDS) {
      flags.push('suspiciously_long_sentence')
    }
  }

  return flags
}

/** Returns the indices of segments whose normalized text repeats an earlier segment's text. */
export function findDuplicateTextIndices(texts: string[]): Set<number> {
  const seen = new Map<string, number>()
  const duplicates = new Set<number>()

  texts.forEach((text, i) => {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
    if (normalized.length === 0) return
    if (seen.has(normalized)) {
      duplicates.add(i)
      duplicates.add(seen.get(normalized) as number)
    } else {
      seen.set(normalized, i)
    }
  })

  return duplicates
}

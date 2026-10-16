import { describe, expect, it } from 'vitest'
import { buildSentenceSegments } from '../../scripts/prepare-lessons/segment'
import type { SrtCue } from '../../scripts/prepare-lessons/types'

function cue(index: number, start: number, end: number, text: string): SrtCue {
  return { index, start, end, text }
}

describe('buildSentenceSegments', () => {
  it('keeps a single complete-sentence cue as one segment', () => {
    const segments = buildSentenceSegments([cue(1, 0, 2, 'Hello there.')])
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ start: 0, end: 2, text: 'Hello there.' })
  })

  it('merges a sentence fragment split across consecutive cues', () => {
    const cues = [
      cue(1, 0, 1, "I didn't think"),
      cue(2, 1, 2.5, "we'd make it here."),
    ]
    const segments = buildSentenceSegments(cues)
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe("I didn't think we'd make it here.")
    expect(segments[0].start).toBe(0)
    expect(segments[0].end).toBe(2.5)
    expect(segments[0].cueIndices).toEqual([1, 2])
  })

  it('splits a cue containing two sentences, distributing time by text length', () => {
    const cues = [cue(1, 0, 10, 'Short one. This second sentence is much longer than the first.')]
    const segments = buildSentenceSegments(cues)
    expect(segments).toHaveLength(2)
    expect(segments[0].text).toBe('Short one.')
    expect(segments[1].text).toBe('This second sentence is much longer than the first.')
    expect(segments[0].start).toBe(0)
    expect(segments[1].end).toBe(10)
    // The longer second sentence should get the larger time share.
    const firstDuration = segments[0].end - segments[0].start
    const secondDuration = segments[1].end - segments[1].start
    expect(secondDuration).toBeGreaterThan(firstDuration)
    // Segments are contiguous (no gap/overlap).
    expect(segments[0].end).toBe(segments[1].start)
  })

  it('keeps an unterminated trailing fragment as its own segment', () => {
    const segments = buildSentenceSegments([cue(1, 0, 1, 'No ending punctuation here')])
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('No ending punctuation here')
  })

  it('skips cues with empty text', () => {
    const cues = [cue(1, 0, 1, ''), cue(2, 1, 2, 'Real sentence.')]
    const segments = buildSentenceSegments(cues)
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('Real sentence.')
  })

  it('handles three consecutive fragments merging into one sentence', () => {
    const cues = [cue(1, 0, 1, 'One'), cue(2, 1, 2, 'two'), cue(3, 2, 3, 'three.')]
    const segments = buildSentenceSegments(cues)
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('One two three.')
    expect(segments[0].cueIndices).toEqual([1, 2, 3])
  })

  it('returns no segments for an empty cue list', () => {
    expect(buildSentenceSegments([])).toEqual([])
  })
})

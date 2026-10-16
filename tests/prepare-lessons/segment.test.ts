import { describe, expect, it } from 'vitest'
import { buildSentenceSegments, groupIntoClips, type SentenceSegment } from '../../scripts/prepare-lessons/segment'
import type { SrtCue } from '../../scripts/prepare-lessons/types'

function cue(index: number, start: number, end: number, text: string): SrtCue {
  return { index, start, end, text }
}

function seg(start: number, end: number, text: string, cueIndices: number[] = [0]): SentenceSegment {
  return { start, end, text, cueIndices }
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

describe('groupIntoClips', () => {
  it('merges short consecutive sentences up toward the target duration', () => {
    // Four 2.5s sentences back-to-back = 10s total, no gaps.
    const segments = [
      seg(0, 2.5, 'One.', [1]),
      seg(2.5, 5, 'Two.', [2]),
      seg(5, 7.5, 'Three.', [3]),
      seg(7.5, 10, 'Four.', [4]),
    ]
    const groups = groupIntoClips(segments, 10, 15, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ start: 0, end: 10, text: 'One. Two. Three. Four.' })
    expect(groups[0].cueIndices).toEqual([1, 2, 3, 4])
  })

  it('starts a new clip once the current one reaches the target duration', () => {
    const segments = [seg(0, 11, 'Long sentence.', [1]), seg(11, 13, 'Short one.', [2])]
    const groups = groupIntoClips(segments, 10, 15, 3)
    expect(groups).toHaveLength(2)
    expect(groups[0].text).toBe('Long sentence.')
    expect(groups[1].text).toBe('Short one.')
  })

  it('never merges past the max duration even if under target', () => {
    const segments = [seg(0, 9, 'A.', [1]), seg(9, 20, 'B.', [2])] // merged would be 20s
    const groups = groupIntoClips(segments, 10, 15, 100)
    expect(groups).toHaveLength(2)
    expect(groups[0].text).toBe('A.')
    expect(groups[1].text).toBe('B.')
  })

  it('does not merge across a gap bigger than maxGapSeconds (e.g. a scene change)', () => {
    const segments = [seg(0, 1, 'Before.', [1]), seg(10, 11, 'After.', [2])] // 9s gap
    const groups = groupIntoClips(segments, 10, 15, 3)
    expect(groups).toHaveLength(2)
  })

  it('never splits a sentence in half — only merges whole sentences', () => {
    const segments = [seg(0, 5, 'One.', [1]), seg(5, 12, 'Two is long.', [2])]
    const groups = groupIntoClips(segments, 10, 15, 3)
    // The merge stays intact as one clip since merged duration (12s) <= max (15s)
    // and current (5s) is under target; the sentence text itself is untouched.
    expect(groups).toHaveLength(1)
    expect(groups[0].text).toBe('One. Two is long.')
  })

  it('returns an empty array for no segments', () => {
    expect(groupIntoClips([], 10)).toEqual([])
  })

  it('passes a single segment through unchanged when already over target', () => {
    const groups = groupIntoClips([seg(0, 20, 'Very long.', [1])], 10, 15, 3)
    expect(groups).toEqual([seg(0, 20, 'Very long.', [1])])
  })
})

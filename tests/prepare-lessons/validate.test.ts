import { describe, expect, it } from 'vitest'
import { validateApprovedCandidates } from '../../scripts/prepare-lessons/validate'
import type { CandidateClip } from '../../scripts/prepare-lessons/types'

function clip(overrides: Partial<CandidateClip> = {}): CandidateClip {
  return {
    id: 'movie-easy-001',
    source: 'movie',
    difficulty: 'easy',
    start: 0,
    end: 2,
    text: 'Hello there.',
    status: 'approved',
    flags: [],
    ...overrides,
  }
}

describe('validateApprovedCandidates', () => {
  it('passes a clean approved clip with audio present', () => {
    const issues = validateApprovedCandidates([clip()], () => true)
    expect(issues).toEqual([])
  })

  it('ignores pending and needs_correction clips entirely', () => {
    const issues = validateApprovedCandidates(
      [clip({ status: 'pending', flags: ['empty_transcript'] }), clip({ status: 'needs_correction' })],
      () => false
    )
    expect(issues).toEqual([])
  })

  it('fails an approved clip with unresolved flags', () => {
    const issues = validateApprovedCandidates(
      [clip({ flags: ['suspiciously_long_sentence'] })],
      () => true
    )
    expect(issues).toEqual([
      { candidateId: 'movie-easy-001', reason: 'unresolved flags: suspiciously_long_sentence' },
    ])
  })

  it('fails an approved clip whose audio file is missing', () => {
    const issues = validateApprovedCandidates([clip()], () => false)
    expect(issues).toEqual([{ candidateId: 'movie-easy-001', reason: 'audio file is missing' }])
  })

  it('reports both issues when a clip has flags and missing audio', () => {
    const issues = validateApprovedCandidates([clip({ flags: ['duplicated_text'] })], () => false)
    expect(issues).toHaveLength(2)
  })

  it('returns no issues for an empty candidate list', () => {
    expect(validateApprovedCandidates([], () => true)).toEqual([])
  })
})

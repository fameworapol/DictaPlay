import { describe, expect, it } from 'vitest'
import { partitionCandidatesByFlag } from '../../scripts/prepare-lessons/candidates'
import type { CandidateClip } from '../../scripts/prepare-lessons/types'

function clip(overrides: Partial<CandidateClip>): CandidateClip {
  return {
    id: 'id',
    source: 'Movie_A',
    difficulty: 'easy',
    start: 0,
    end: 1,
    text: 'Text.',
    status: 'pending',
    flags: [],
    ...overrides,
  }
}

describe('partitionCandidatesByFlag', () => {
  it('splits candidates carrying the flag from the rest', () => {
    const silent = clip({ id: 'a', flags: ['long_silence'] })
    const clean = clip({ id: 'b', flags: [] })
    const { toRemove, toKeep } = partitionCandidatesByFlag([silent, clean], 'long_silence')
    expect(toRemove.map((c) => c.id)).toEqual(['a'])
    expect(toKeep.map((c) => c.id)).toEqual(['b'])
  })

  it('keeps a candidate that has other flags but not the target one', () => {
    const other = clip({ id: 'a', flags: ['duplicated_text'] })
    const { toRemove, toKeep } = partitionCandidatesByFlag([other], 'long_silence')
    expect(toRemove).toEqual([])
    expect(toKeep.map((c) => c.id)).toEqual(['a'])
  })

  it('removes a candidate carrying the flag among several others', () => {
    const multi = clip({ id: 'a', flags: ['duplicated_text', 'long_silence'] })
    const { toRemove } = partitionCandidatesByFlag([multi], 'long_silence')
    expect(toRemove.map((c) => c.id)).toEqual(['a'])
  })

  it('scopes removal to one source when given', () => {
    const movieA = clip({ id: 'a', source: 'Movie_A', flags: ['long_silence'] })
    const movieB = clip({ id: 'b', source: 'Movie_B', flags: ['long_silence'] })
    const { toRemove, toKeep } = partitionCandidatesByFlag([movieA, movieB], 'long_silence', 'Movie_A')
    expect(toRemove.map((c) => c.id)).toEqual(['a'])
    expect(toKeep.map((c) => c.id)).toEqual(['b'])
  })

  it('removes nothing when no candidate carries the flag', () => {
    const { toRemove, toKeep } = partitionCandidatesByFlag([clip({ id: 'a' })], 'long_silence')
    expect(toRemove).toEqual([])
    expect(toKeep).toHaveLength(1)
  })
})

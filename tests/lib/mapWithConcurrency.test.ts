import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from '../../src/lib/async/mapWithConcurrency'

describe('mapWithConcurrency', () => {
  it('returns results in the original order regardless of completion order', async () => {
    const items = [30, 10, 20]
    const results = await mapWithConcurrency(items, 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
      return ms
    })
    expect(results).toEqual([30, 10, 20])
  })

  it('never exceeds the concurrency limit', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 20 }, (_, i) => i)

    await mapWithConcurrency(items, 4, async (i) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active--
      return i
    })

    expect(maxActive).toBeLessThanOrEqual(4)
  })

  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const seen = new Set<number>()
    await mapWithConcurrency(items, 7, async (i) => {
      seen.add(i)
      return i
    })
    expect(seen.size).toBe(50)
  })

  it('handles an empty array', async () => {
    const results = await mapWithConcurrency([], 5, async (i) => i)
    expect(results).toEqual([])
  })

  it('handles a limit larger than the item count', async () => {
    const results = await mapWithConcurrency([1, 2], 100, async (i) => i * 2)
    expect(results).toEqual([2, 4])
  })

  it('propagates an error from fn', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new Error('boom')
        return i
      })
    ).rejects.toThrow('boom')
  })
})

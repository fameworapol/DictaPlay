/**
 * Maps over `items` with at most `limit` calls to `fn` in flight at once.
 * Unbounded Promise.all over hundreds of fetch() calls can hit a browser's
 * per-tab outstanding-request limit (seen as ERR_INSUFFICIENT_RESOURCES in
 * Chromium once the production lesson index grew past a few hundred
 * exercises) — this keeps the same "check everything" behavior without
 * blowing past that limit.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}

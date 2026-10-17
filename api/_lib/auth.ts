import type { VercelRequest } from '@vercel/node'

/**
 * Single shared-secret check. This is obscurity, not real security — the
 * matching key ships in the client bundle (VITE_SYNC_API_KEY), so anyone
 * who opens devtools can read it and call this API directly. Acceptable
 * here because the data is low-stakes personal practice scores for a
 * single-user app, and a real auth system would bend this project's
 * "no login" constraint further than a header check does.
 */
export function isAuthorized(req: VercelRequest): boolean {
  const expected = process.env.SYNC_API_KEY
  if (!expected) return false
  const provided = req.headers['x-sync-key']
  return provided === expected
}

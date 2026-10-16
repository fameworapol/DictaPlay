import type { CandidateClip } from './types'

export interface ValidationIssue {
  candidateId: string
  reason: string
}

/**
 * Checks the clips that would actually be exported (status === 'approved').
 * A clip that is still 'pending' or 'needs_correction' simply isn't exported
 * yet — it's not a validation failure, it's excluded. Fails only when an
 * approved clip has unresolved flags or its audio file is missing.
 */
export function validateApprovedCandidates(
  candidates: CandidateClip[],
  audioExists: (candidate: CandidateClip) => boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const candidate of candidates) {
    if (candidate.status !== 'approved') continue

    if (candidate.flags.length > 0) {
      issues.push({
        candidateId: candidate.id,
        reason: `unresolved flags: ${candidate.flags.join(', ')}`,
      })
    }
    if (!audioExists(candidate)) {
      issues.push({ candidateId: candidate.id, reason: 'audio file is missing' })
    }
  }

  return issues
}

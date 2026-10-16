export interface Token {
  /** As-authored/as-typed text, trimmed of surrounding whitespace only. Used for display. */
  raw: string
  /** Lowercased, edge-punctuation-stripped, apostrophe-canonicalized. Used for matching. */
  normalized: string
}

// Smart/curly quotes that should be treated as equivalent to a straight apostrophe.
const CURLY_APOSTROPHES = /[‘’ʼ′]/g

function canonicalizeApostrophes(word: string): string {
  return word.replace(CURLY_APOSTROPHES, "'")
}

/**
 * Strips punctuation from the start/end of a word only. Internal characters
 * (apostrophes in contractions like "don't", hyphens in "well-known") are kept,
 * which is what keeps contractions and hyphenated words as single tokens.
 */
function stripEdgePunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '')
}

/**
 * Splits a sentence into word tokens for comparison.
 * - Case-insensitive (normalized form is lowercased).
 * - Whitespace is collapsed; leading/trailing whitespace trimmed.
 * - Leading/trailing punctuation is stripped from each word.
 * - Curly and straight apostrophes are treated as equal.
 * - Contractions and hyphenated words remain single tokens (no internal splitting).
 * - Tokens that are pure punctuation (become empty after stripping) are dropped.
 *
 * Never mutates the input string; returns a new token list.
 */
export function tokenize(text: string): Token[] {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0)

  const tokens: Token[] = []
  for (const raw of words) {
    const canonical = canonicalizeApostrophes(raw)
    const normalized = stripEdgePunctuation(canonical).toLowerCase()
    if (normalized.length === 0) continue
    tokens.push({ raw, normalized })
  }
  return tokens
}

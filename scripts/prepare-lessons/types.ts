export type Difficulty = 'easy' | 'medium' | 'hard'

export interface SrtCue {
  /** 1-based index as written in the SRT file (not guaranteed sequential/unique in the wild). */
  index: number
  start: number
  end: number
  text: string
}

export type CandidateStatus = 'pending' | 'approved' | 'needs_correction'

export type CandidateFlag =
  | 'empty_transcript'
  | 'missing_audio'
  | 'invalid_range'
  | 'too_short_for_word_count'
  | 'long_silence'
  | 'subtitle_stt_mismatch'
  | 'duplicated_text'
  | 'suspiciously_long_sentence'

export interface CandidateClip {
  id: string
  /** Source movie identifier, e.g. the mkv filename stem. */
  source: string
  difficulty: Difficulty
  start: number
  end: number
  text: string
  status: CandidateStatus
  flags: CandidateFlag[]
}

export interface CandidatesFile {
  schemaVersion: 1
  candidates: CandidateClip[]
}

export interface MovieSource {
  /** Identifier used in CandidateClip.source and in workdir paths. */
  id: string
  mkvPath: string
  difficulty: Difficulty
}

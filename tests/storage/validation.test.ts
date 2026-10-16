import { describe, expect, it } from 'vitest'
import { hasAllowedAudioMimeType, validateAudioFile } from '../../src/lib/validation/audioFile'
import { validateExerciseInput } from '../../src/lib/validation/exerciseInput'

describe('validateExerciseInput', () => {
  it('passes with all required fields present', () => {
    expect(
      validateExerciseInput({ title: 'Title', transcript: 'Some text.', audioBlobId: 'blob-1' })
    ).toEqual([])
  })

  it('fails when title is missing', () => {
    const errors = validateExerciseInput({ title: '  ', transcript: 'Text.', audioBlobId: 'blob-1' })
    expect(errors.map((e) => e.field)).toContain('title')
  })

  it('fails when transcript is missing', () => {
    const errors = validateExerciseInput({ title: 'Title', transcript: '', audioBlobId: 'blob-1' })
    expect(errors.map((e) => e.field)).toContain('transcript')
  })

  it('fails when audio is missing', () => {
    const errors = validateExerciseInput({ title: 'Title', transcript: 'Text.', audioBlobId: null })
    expect(errors.map((e) => e.field)).toContain('audio')
  })

  it('reports all missing fields at once', () => {
    const errors = validateExerciseInput({ title: '', transcript: '', audioBlobId: null })
    expect(errors).toHaveLength(3)
  })
})

describe('hasAllowedAudioMimeType', () => {
  it.each(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'])('accepts %s', (type) => {
    expect(hasAllowedAudioMimeType({ type })).toBe(true)
  })

  it.each(['video/mp4', 'image/png', 'text/plain', ''])('rejects %s', (type) => {
    expect(hasAllowedAudioMimeType({ type })).toBe(false)
  })
})

describe('validateAudioFile', () => {
  it('rejects an unsupported MIME type before even checking decodability', async () => {
    const decodeCheck = async () => true
    const result = await validateAudioFile({ type: 'video/mp4', name: 'clip.mp4' }, decodeCheck)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/Unsupported file type/)
  })

  it('rejects a correctly-typed file the browser cannot decode', async () => {
    const decodeCheck = async () => false
    const result = await validateAudioFile({ type: 'audio/mpeg', name: 'broken.mp3' }, decodeCheck)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/could not decode/)
  })

  it('accepts a correctly-typed, decodable file', async () => {
    const decodeCheck = async () => true
    const result = await validateAudioFile({ type: 'audio/wav', name: 'ok.wav' }, decodeCheck)
    expect(result.valid).toBe(true)
  })
})

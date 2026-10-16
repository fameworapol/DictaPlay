const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
])

export interface AudioValidationResult {
  valid: boolean
  reason?: string
}

/** MIME-type check only, no DOM access — easy to unit test. */
export function hasAllowedAudioMimeType(file: Pick<File, 'type'>): boolean {
  return ALLOWED_MIME_TYPES.has(file.type)
}

/**
 * Real browser decode check: tries to load the file as an <audio> element
 * and waits for either metadata (decodable) or an error. Exists as its own
 * function so tests can inject a fake instead of relying on jsdom's media
 * support, while production always uses this real check.
 */
export function canBrowserDecodeAudio(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    const cleanup = () => URL.revokeObjectURL(url)
    const timeout = setTimeout(() => {
      cleanup()
      resolve(false)
    }, 5000)
    audio.addEventListener(
      'loadedmetadata',
      () => {
        clearTimeout(timeout)
        cleanup()
        resolve(true)
      },
      { once: true }
    )
    audio.addEventListener(
      'error',
      () => {
        clearTimeout(timeout)
        cleanup()
        resolve(false)
      },
      { once: true }
    )
    audio.src = url
  })
}

/**
 * Validates an uploaded audio file by MIME type and by whether it can
 * actually be decoded/played, per the project's import requirements.
 * `decodeCheck` defaults to the real browser check; tests inject a stub.
 */
export async function validateAudioFile(
  file: Pick<File, 'type' | 'name'>,
  decodeCheck: (file: File) => Promise<boolean> = canBrowserDecodeAudio
): Promise<AudioValidationResult> {
  if (!hasAllowedAudioMimeType(file)) {
    return {
      valid: false,
      reason: `Unsupported file type "${file.type || 'unknown'}" for ${file.name}. Use MP3, WAV, or M4A.`,
    }
  }
  const canDecode = await decodeCheck(file as File)
  if (!canDecode) {
    return { valid: false, reason: `This browser could not decode "${file.name}".` }
  }
  return { valid: true }
}

import { useEffect, useState } from 'react'
import { getAudioBlob } from '../../lib/storage'
import type { Exercise } from '../../types/lesson'

interface ExerciseAudioSrc {
  src: string | null
  error: string | null
}

/**
 * Resolves the playable audio src for an exercise: a direct /public path for
 * built-in/sample exercises, or an object URL backed by an IndexedDB blob
 * for custom ones. Revokes the object URL on cleanup to avoid leaking it.
 * Accepts null so callers can use it unconditionally before an exercise is
 * known (React hooks can't be called conditionally).
 */
export function useExerciseAudioSrc(exercise: Exercise | null): ExerciseAudioSrc {
  const [state, setState] = useState<ExerciseAudioSrc>({ src: null, error: null })

  useEffect(() => {
    if (!exercise) {
      setState({ src: null, error: null })
      return
    }

    if (exercise.audioPath) {
      setState({ src: `/${exercise.audioPath}`, error: null })
      return
    }

    if (!exercise.audioBlobId) {
      setState({ src: null, error: 'This exercise has no audio.' })
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setState({ src: null, error: null })

    getAudioBlob(exercise.audioBlobId).then((record) => {
      if (cancelled) return
      if (!record) {
        setState({ src: null, error: "This exercise's audio could not be found." })
        return
      }
      objectUrl = URL.createObjectURL(record.blob)
      setState({ src: objectUrl, error: null })
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // Deliberately narrower than [exercise]: the exercise object is a fresh
    // reference on every parent render (derived from an array), which would
    // re-trigger this effect every render and churn object URLs needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.audioPath, exercise?.audioBlobId])

  return state
}

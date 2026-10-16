import { useEffect, useRef, useState } from 'react'

const SPEED_OPTIONS = [0.5, 0.75, 1] as const
const SPEED_STORAGE_KEY = 'dictation.playbackRate'

function getStoredSpeed(): number {
  try {
    const raw = window.localStorage.getItem(SPEED_STORAGE_KEY)
    const parsed = raw ? Number(raw) : NaN
    return (SPEED_OPTIONS as readonly number[]).includes(parsed) ? parsed : 1
  } catch {
    return 1
  }
}

interface AudioPlayerProps {
  src: string
  label: string
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(getStoredSpeed)
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setHasError(false)
    setIsPlaying(false)
  }, [src, reloadKey])

  function applySpeed() {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }

  function handlePlayPause() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => setHasError(true))
    } else {
      audio.pause()
    }
  }

  function handleReplay() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => setHasError(true))
  }

  function handleSpeedChange(next: number) {
    setSpeed(next)
    try {
      window.localStorage.setItem(SPEED_STORAGE_KEY, String(next))
    } catch {
      // LocalStorage unavailable (e.g. private mode); speed just won't persist.
    }
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  function handleRetry() {
    setHasError(false)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" role="group" aria-label={label}>
      <audio
        key={reloadKey}
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={applySpeed}
        onError={() => setHasError(true)}
      />
      {hasError ? (
        <div className="flex items-center justify-between gap-3" role="alert">
          <p className="text-sm text-red-700">Audio failed to load.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePlayPause}
            aria-pressed={isPlaying}
            className="min-w-24 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={handleReplay}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Replay
          </button>
          <div className="flex items-center gap-2" role="group" aria-label="Playback speed">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleSpeedChange(option)}
                aria-pressed={speed === option}
                className={
                  speed === option
                    ? 'rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                    : 'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100'
                }
              >
                {option}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

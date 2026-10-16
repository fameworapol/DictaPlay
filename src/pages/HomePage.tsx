import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllProgress, getAllSessions, getLastSession } from '../lib/storage'
import type { SessionRecord } from '../lib/storage'

interface HomeStats {
  exercisesCompleted: number
  sessionsCount: number
  lastSession: SessionRecord | null
}

export function HomePage() {
  const [stats, setStats] = useState<HomeStats | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getAllProgress(), getAllSessions(), getLastSession()]).then(
      ([progress, sessions, lastSession]) => {
        if (cancelled) return
        setStats({
          exercisesCompleted: progress.filter((p) => p.completed).length,
          sessionsCount: sessions.length,
          lastSession,
        })
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">English Dictation</h1>
        <p className="mt-2 text-slate-600">
          Listen to a short clip, type what you hear, and get word-by-word feedback on your
          spelling and listening accuracy.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/library"
            className="inline-block rounded-md bg-brand-600 px-5 py-3 text-base font-semibold text-white hover:bg-brand-700"
          >
            Browse lessons
          </Link>
          {stats?.lastSession && (
            <Link
              to={`/practice/${stats.lastSession.lessonId}`}
              className="inline-block rounded-md border border-slate-300 px-5 py-3 text-base font-semibold text-slate-700 hover:bg-slate-100"
            >
              Continue Practicing: {stats.lastSession.lessonTitle}
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Your progress</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-slate-100 p-3 text-center">
            <dt className="text-xs text-slate-500">Exercises completed</dt>
            <dd className="text-xl font-semibold">{stats?.exercisesCompleted ?? 0}</dd>
          </div>
          <div className="rounded-md bg-slate-100 p-3 text-center">
            <dt className="text-xs text-slate-500">Sessions</dt>
            <dd className="text-xl font-semibold">{stats?.sessionsCount ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">About the sample content</h2>
        <p className="mt-2 text-sm text-slate-600">
          Lessons labeled <span className="font-semibold">Sample</span> use short sentences read by
          a text-to-speech voice, not real movie audio. They exist to exercise the practice flow
          while real lesson content is prepared separately.
        </p>
      </section>
    </div>
  )
}

import { Link, useLocation } from 'react-router-dom'
import type { SessionStats } from '../features/practice/types'

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function SummaryPage() {
  const location = useLocation()
  const stats = location.state as SessionStats | null

  if (!stats) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
        <p>No session to summarize.</p>
        <Link to="/library" className="mt-2 inline-block font-medium underline">
          Back to Library
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Session Summary</h1>
        <p className="text-slate-600">{stats.lessonTitle}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attempted" value={stats.attempted} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Exact matches" value={stats.exactMatches} />
        <Stat
          label="Total errors"
          value={stats.errorTotals.incorrect + stats.errorTotals.missing + stats.errorTotals.extra}
        />
        <Stat label="Duration" value={formatDuration(stats.activeDurationMs)} />
      </dl>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-600">Word-level error totals</h2>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <Stat label="Incorrect" value={stats.errorTotals.incorrect} />
          <Stat label="Missing" value={stats.errorTotals.missing} />
          <Stat label="Extra" value={stats.errorTotals.extra} />
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/practice/${stats.lessonId}`}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Practice Again
        </Link>
        <Link
          to="/library"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Back to Library
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-100 p-3 text-center">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  )
}

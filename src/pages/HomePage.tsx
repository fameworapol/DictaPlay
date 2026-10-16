import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">English Dictation</h1>
        <p className="mt-2 text-slate-600">
          Listen to a short clip, type what you hear, and get word-by-word feedback on your
          spelling and listening accuracy.
        </p>
        <Link
          to="/library"
          className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-3 text-base font-semibold text-white hover:bg-brand-700"
        >
          Browse lessons
        </Link>
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

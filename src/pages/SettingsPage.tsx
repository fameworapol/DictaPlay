import { useRef, useState } from 'react'
import { useLessonData } from '../features/lessons/useLessonData'
import { applyBackup, buildBackup, type ImportResult } from '../lib/storage'

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const { refresh } = useLessonData()
  const [includeAudio, setIncludeAudio] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    const backup = await buildBackup(includeAudio)
    const suffix = includeAudio ? 'with-audio' : 'metadata-only'
    downloadJson(`english-dictation-backup-${suffix}-${Date.now()}.json`, backup)
  }

  async function handleImportFile(file: File) {
    setImportResult(null)
    setImportErrors([])
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await applyBackup(data)
      if (result.errors.length > 0) {
        setImportErrors(result.errors)
      } else {
        setImportResult(result)
        refresh()
      }
    } catch {
      setImportErrors(['That file is not valid JSON.'])
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Export your custom lessons and practice history as a JSON file. A metadata-only export
          does not contain audio — only re-import it on a browser that still has the original
          audio, or exercises will show as missing audio.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeAudio}
            onChange={(e) => setIncludeAudio(e.target.checked)}
          />
          Include audio (makes the file much larger)
        </label>
        <button
          type="button"
          onClick={handleExport}
          className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Export backup
        </button>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <label className="block text-sm font-medium" htmlFor="import-file">
            Import a backup file
          </label>
          <input
            id="import-file"
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
            }}
            className="mt-1 block text-sm"
          />
          {importErrors.length > 0 && (
            <ul className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">
              {importErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {importResult && (
            <p className="mt-2 rounded-md bg-green-50 p-2 text-sm text-green-800" role="status">
              Imported {importResult.importedLessons} lesson(s) and {importResult.importedExercises}{' '}
              exercise(s).
              {importResult.exercisesMissingAudio.length > 0 &&
                ` ${importResult.exercisesMissingAudio.length} exercise(s) are missing audio (metadata-only import or the original audio wasn't found).`}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Importing never overwrites built-in or sample lessons — custom content always uses its
            own id namespace.
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">About your data</h2>
        <p className="mt-1 text-sm text-slate-600">
          Everything you create — custom lessons, exercise audio, and practice history — is stored
          only in this browser, via IndexedDB. Nothing is sent to a server. Clearing your browser's
          site data for this app will permanently remove your custom lessons and progress unless
          you've exported a backup first.
        </p>
      </section>
    </div>
  )
}

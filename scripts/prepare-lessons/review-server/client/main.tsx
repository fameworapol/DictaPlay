import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

type CandidateStatus = 'pending' | 'approved' | 'needs_correction'

interface Candidate {
  id: string
  source: string
  difficulty: 'easy' | 'medium' | 'hard'
  start: number
  end: number
  text: string
  status: CandidateStatus
  flags: string[]
  audioAvailable: boolean
}

const STATUS_COLOR: Record<CandidateStatus, string> = {
  pending: '#64748b',
  approved: '#16a34a',
  needs_correction: '#dc2626',
}

function fmt(seconds: number): string {
  return seconds.toFixed(2) + 's'
}

async function patchCandidate(id: string, body: Partial<Pick<Candidate, 'text' | 'start' | 'end' | 'status'>>) {
  const res = await fetch(`/api/candidates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as Candidate
}

function App() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ text: string; start: string; end: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterSource, setFilterSource] = useState<string>('all')

  async function reload() {
    const res = await fetch('/api/candidates')
    const data = (await res.json()) as Candidate[]
    setCandidates(data)
    return data
  }

  useEffect(() => {
    reload()
  }, [])

  const selected = candidates?.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    if (selected) {
      setDraft({ text: selected.text, start: String(selected.start), end: String(selected.end) })
    } else {
      setDraft(null)
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const sources = useMemo(
    () => Array.from(new Set((candidates ?? []).map((c) => c.source))),
    [candidates]
  )

  const visible = (candidates ?? []).filter((c) => filterSource === 'all' || c.source === filterSource)

  async function handleSave() {
    if (!selected || !draft) return
    setSaving(true)
    try {
      await patchCandidate(selected.id, {
        text: draft.text,
        start: Number(draft.start),
        end: Number(draft.end),
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(status: CandidateStatus) {
    if (!selected) return
    setSaving(true)
    try {
      await patchCandidate(selected.id, { status })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  function nudge(field: 'start' | 'end', deltaSeconds: number) {
    if (!draft) return
    const current = Number(draft[field]) || 0
    setDraft({ ...draft, [field]: (current + deltaSeconds).toFixed(2) })
  }

  if (!candidates) return <div style={{ padding: 24 }}>Loading candidates…</div>

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside style={{ width: 340, borderRight: '1px solid #e2e8f0', overflowY: 'auto', background: '#fff' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
          <strong>{visible.length}</strong> candidate(s)
          <div style={{ marginTop: 8 }}>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ width: '100%' }}>
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {visible.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 10,
              border: 'none',
              borderBottom: '1px solid #f1f5f9',
              background: c.id === selectedId ? '#eff6ff' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 12, color: STATUS_COLOR[c.status], fontWeight: 600 }}>
              {c.status.replace('_', ' ')}
              {!c.audioAvailable && ' · no audio'}
              {c.flags.length > 0 && ` · ${c.flags.length} flag(s)`}
            </div>
            <div style={{ fontSize: 13, marginTop: 2 }}>{c.text || <em>(empty)</em>}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {c.id} · {fmt(c.start)}–{fmt(c.end)}
            </div>
          </button>
        ))}
      </aside>

      <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {!selected || !draft ? (
          <p>Select a candidate on the left.</p>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <h1 style={{ fontSize: 18 }}>{selected.id}</h1>
            <p style={{ color: '#64748b' }}>
              source: {selected.source} · difficulty: {selected.difficulty} · status:{' '}
              <span style={{ color: STATUS_COLOR[selected.status] }}>{selected.status}</span>
            </p>

            {selected.flags.length > 0 && (
              <div style={{ background: '#fef3c7', padding: 10, borderRadius: 6, marginBottom: 12 }}>
                Flags: {selected.flags.join(', ')}
              </div>
            )}

            {selected.audioAvailable ? (
              <audio key={selected.id} controls src={`/api/audio/${encodeURIComponent(selected.id)}`} style={{ width: '100%' }} />
            ) : (
              <p style={{ color: '#dc2626' }}>No audio file for this candidate yet.</p>
            )}

            <label style={{ display: 'block', marginTop: 16 }}>
              Transcript
              <textarea
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                rows={3}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>

            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <div>
                <label>
                  Start (s)
                  <input
                    type="number"
                    step="0.01"
                    value={draft.start}
                    onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  />
                </label>
                <div style={{ marginTop: 4 }}>
                  <button onClick={() => nudge('start', -0.5)}>-0.5</button>
                  <button onClick={() => nudge('start', -0.1)}>-0.1</button>
                  <button onClick={() => nudge('start', 0.1)}>+0.1</button>
                  <button onClick={() => nudge('start', 0.5)}>+0.5</button>
                </div>
              </div>
              <div>
                <label>
                  End (s)
                  <input
                    type="number"
                    step="0.01"
                    value={draft.end}
                    onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  />
                </label>
                <div style={{ marginTop: 4 }}>
                  <button onClick={() => nudge('end', -0.5)}>-0.5</button>
                  <button onClick={() => nudge('end', -0.1)}>-0.1</button>
                  <button onClick={() => nudge('end', 0.1)}>+0.1</button>
                  <button onClick={() => nudge('end', 0.5)}>+0.5</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button disabled={saving} onClick={handleSave}>
                Save (re-cuts audio if times changed)
              </button>
              <button disabled={saving} onClick={() => handleStatus('approved')} style={{ color: '#16a34a' }}>
                Approve
              </button>
              <button disabled={saving} onClick={() => handleStatus('needs_correction')} style={{ color: '#dc2626' }}>
                Needs correction
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)

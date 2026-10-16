import { useState, type FormEvent } from 'react'
import { DIFFICULTY_LABEL } from '../features/lessons/constants'
import { useLessonData } from '../features/lessons/useLessonData'
import {
  addAudioBlob,
  createCustomLesson,
  deleteAudioBlob,
  deleteCustomExercise,
  deleteCustomLesson,
  exercisesReferencingBlob,
  reorderLessonExercises,
  saveCustomExercise,
} from '../lib/storage'
import { validateAudioFile } from '../lib/validation/audioFile'
import { validateExerciseInput } from '../lib/validation/exerciseInput'
import type { Difficulty, Exercise, Lesson } from '../types/lesson'

interface ExerciseDraft {
  id?: string
  lessonId: string
  title: string
  transcript: string
  difficulty: Difficulty
  audioFile: File | null
  /** Set when editing and the audio isn't being replaced. */
  keepExistingAudioBlobId?: string
}

function emptyDraft(lessonId: string, difficulty: Difficulty): ExerciseDraft {
  return { lessonId, title: '', transcript: '', difficulty, audioFile: null }
}

export function ManagePage() {
  const { state, refresh } = useLessonData()
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [newLessonDifficulty, setNewLessonDifficulty] = useState<Difficulty>('easy')
  const [draft, setDraft] = useState<ExerciseDraft | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  if (state.status !== 'ready') {
    return <p className="text-slate-600">Loading…</p>
  }

  const customLessons = state.lessons.filter((l) => l.source === 'custom')

  async function handleCreateLesson(event: FormEvent) {
    event.preventDefault()
    if (!newLessonTitle.trim()) return
    await createCustomLesson(newLessonTitle.trim(), newLessonDifficulty)
    setNewLessonTitle('')
    refresh()
  }

  async function handleDeleteLesson(lesson: Lesson) {
    const count = lesson.exerciseIds.length
    const confirmed = window.confirm(
      count > 0
        ? `Delete "${lesson.title}"? This will also delete its ${count} exercise(s). This can't be undone.`
        : `Delete "${lesson.title}"?`
    )
    if (!confirmed) return
    await deleteCustomLesson(lesson.id)
    refresh()
  }

  function startAddExercise(lesson: Lesson) {
    setFormErrors([])
    setDraft(emptyDraft(lesson.id, lesson.difficulty))
  }

  function startEditExercise(exercise: Exercise) {
    setFormErrors([])
    setDraft({
      id: exercise.id,
      lessonId: exercise.lessonId,
      title: exercise.title,
      transcript: exercise.transcript,
      difficulty: exercise.difficulty,
      audioFile: null,
      keepExistingAudioBlobId: exercise.audioBlobId,
    })
  }

  async function handleSaveExercise(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setFormErrors([])

    let audioBlobId = draft.keepExistingAudioBlobId ?? null

    if (draft.audioFile) {
      const validation = await validateAudioFile(draft.audioFile)
      if (!validation.valid) {
        setFormErrors([validation.reason ?? 'Invalid audio file.'])
        return
      }
    }

    const fieldErrors = validateExerciseInput({
      title: draft.title,
      transcript: draft.transcript,
      audioBlobId: draft.audioFile ? 'pending' : audioBlobId,
    })
    if (fieldErrors.length > 0) {
      setFormErrors(fieldErrors.map((e) => e.message))
      return
    }

    setBusy(true)
    try {
      if (draft.audioFile) {
        const newBlobId = await addAudioBlob(draft.audioFile, draft.audioFile.type)
        if (!newBlobId) {
          setFormErrors(['Storage is unavailable, so audio could not be saved.'])
          return
        }
        audioBlobId = newBlobId
      }

      await saveCustomExercise({
        id: draft.id,
        lessonId: draft.lessonId,
        title: draft.title.trim(),
        transcript: draft.transcript.trim(),
        difficulty: draft.difficulty,
        audioBlobId: audioBlobId!,
      })
      setDraft(null)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteExercise(exercise: Exercise) {
    let message = `Delete "${exercise.title}"?`
    if (exercise.audioBlobId) {
      const sharing = await exercisesReferencingBlob(exercise.audioBlobId, exercise.id)
      if (sharing.length > 0) {
        message += ` Its audio is also used by ${sharing.length} other exercise(s); that audio will be kept for them.`
      }
    }
    if (!window.confirm(message)) return

    await deleteCustomExercise(exercise.id)

    if (exercise.audioBlobId) {
      const stillUsed = await exercisesReferencingBlob(exercise.audioBlobId)
      if (stillUsed.length === 0) await deleteAudioBlob(exercise.audioBlobId)
    }
    refresh()
  }

  async function handleMove(lesson: Lesson, exerciseId: string, direction: -1 | 1) {
    const ids = [...lesson.exerciseIds]
    const index = ids.indexOf(exerciseId)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await reorderLessonExercises(lesson.id, ids)
    refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Content</h1>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">New lesson</h2>
        <form onSubmit={handleCreateLesson} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Title
            <input
              type="text"
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
              placeholder="My lesson"
            />
          </label>
          <label className="text-sm">
            Difficulty
            <select
              value={newLessonDifficulty}
              onChange={(e) => setNewLessonDifficulty(e.target.value as Difficulty)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Create lesson
          </button>
        </form>
      </section>

      {customLessons.length === 0 ? (
        <p className="text-slate-600">You haven't created any lessons yet.</p>
      ) : (
        customLessons.map((lesson) => (
          <section key={lesson.id} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {lesson.title} <span className="text-sm font-normal text-slate-500">({DIFFICULTY_LABEL[lesson.difficulty]})</span>
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startAddExercise(lesson)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                >
                  Add exercise
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLesson(lesson)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete lesson
                </button>
              </div>
            </div>

            {lesson.exerciseIds.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No exercises yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lesson.exerciseIds.map((exerciseId, index) => {
                  const exercise = state.exercisesById.get(exerciseId)
                  if (!exercise) return null
                  return (
                    <li
                      key={exerciseId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3"
                    >
                      <div>
                        <p className="font-medium">{exercise.title}</p>
                        <p className="text-sm text-slate-500">{exercise.transcript}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => handleMove(lesson, exerciseId, -1)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === lesson.exerciseIds.length - 1}
                          onClick={() => handleMove(lesson, exerciseId, 1)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditExercise(exercise)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(exercise)}
                          className="rounded-md border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {draft && draft.lessonId === lesson.id && (
              <form onSubmit={handleSaveExercise} className="mt-4 space-y-3 rounded-md border border-slate-200 p-4">
                <h3 className="font-medium">{draft.id ? 'Edit exercise' : 'New exercise'}</h3>
                {formErrors.length > 0 && (
                  <ul className="rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">
                    {formErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <label className="block text-sm">
                  Title
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Transcript
                  <textarea
                    value={draft.transcript}
                    onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Audio file (MP3, WAV, or M4A)
                  <input
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
                    onChange={(e) => setDraft({ ...draft, audioFile: e.target.files?.[0] ?? null })}
                    className="mt-1 block w-full text-sm"
                  />
                  {draft.keepExistingAudioBlobId && !draft.audioFile && (
                    <span className="text-xs text-slate-500">Keeping existing audio.</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        ))
      )}
    </div>
  )
}

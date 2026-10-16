# English Dictation — Revised Prompts (4 parts)

Run the parts in order, in the same repository. Commit after each part.
Paste the **Shared Context** at the top of every part.

---

## Shared Context (paste at the top of every part)

**Project:** English Dictation — a responsive web app for practicing English listening and spelling. The user hears a short clip, types the whole sentence, and gets word-level feedback.

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 + React Router. IndexedDB (via the `idb` library) for user data. LocalStorage for small preferences only. Vitest + Testing Library + `fake-indexeddb` for tests. Deploy as a static site on Vercel.

**Hard constraints**
1. No backend, no database server, no login. All user data stays in the browser.
2. Never send answers, custom audio or history to any external service. No API keys in the frontend.
3. Do not put source movie files, temporary audio, or model weights in the repo's deployed output.
4. No machine-specific absolute paths anywhere.
5. UI language: English. (Change this line if you want a Thai UI.)

**Honesty rules (apply to everything you do and report)**
- Only say something works if you implemented it and ran it. Report failing tests or skipped steps with their real output.
- Never invent transcripts, timestamps or fake movie lessons. Sample data must be labeled "Sample" in the UI and live in a separate folder from production lessons.
- Steps that need a human (reviewing clips) or an external install (FFmpeg, Whisper) must be documented as such, not simulated.

**Working method:** Inspect the repo first and summarize its state in a few lines. If it is empty, scaffold with Vite. Choose simple defaults for ambiguous points and list them under "Decisions" in your final report. Don't stop at a plan; implement.

**Recommended structure** (adjust only with a clear reason)
```
src/{app,components,pages,features/{lessons,practice,feedback,progress,custom-lessons},hooks,lib/{storage,audio,text-comparison,validation},types,data,styles}
public/audio/built-in/        # approved clips only
scripts/{prepare-lessons,validate-lessons}/
tests/
```

---

## Part 1 — Core app with sample data

**Goal:** A working practice loop with built-in sample lessons and a correct comparison engine.

**Build**
1. Layout and routes: Home, Lesson Library, Practice, Session Summary. Mobile-first, no horizontal scroll, large touch targets, semantic HTML, keyboard accessible, visible focus.
2. Lesson data model (TypeScript types + JSON index):
   - `Lesson { id, title, difficulty: 'easy'|'medium'|'hard', source: 'builtin'|'custom', exerciseIds }`
   - `Exercise { id, lessonId, title, difficulty, audioPath (relative, e.g. "audio/built-in/easy/ex-001.mp3"), transcript, sourceId? }`
   - The production index contains only approved exercises. Load the index with `fetch` at runtime (not bundled into JS). Hide any lesson whose audio fails to load, and show a clear state if one can't be loaded.
3. Sample data: a handful of short exercises per difficulty, clearly labeled "Sample". Generate the audio with a free local TTS (e.g. macOS `say` + FFmpeg) or ask me for files. Do not imply they come from the movies.
4. Practice page: lesson title, difficulty, "Question N of M", audio player (play/pause, replay, speeds 0.5x / 0.75x / 1x), answer textarea with label, Check, Clear, Retry, Next. Ctrl/Cmd+Enter submits. Never show the transcript before checking. Audio errors show a message and a Retry button. Remember the playback speed in LocalStorage.
5. Comparison engine in `lib/text-comparison` (pure functions, no UI):
   - Normalization: case-insensitive; collapse whitespace; trim; strip leading/trailing punctuation from words; treat curly and straight apostrophes as equal; keep contractions ("don't", "I'm") as single words; keep hyphenated words as one word. Default is lenient (punctuation ignored). Never modify the user's submitted text and never modify the stored transcript.
   - Alignment: Levenshtein-style dynamic programming over word sequences with backtrace, returning ops `correct | incorrect | missing | extra`. Prefer the alignment with the fewest edits; break ties deterministically (document the rule). One missing word must not mark later words wrong.
   - Numbers vs. words ("5" vs "five") count as incorrect in this version; document it as a known limitation.
6. Feedback UI: show the correct sentence, the user's answer annotated per word, and counts of correct/incorrect/missing/extra. Do not rely on color alone: use labels or symbols (e.g. ✓, ≠, − , +) plus text/ARIA labels. Provide Retry and Next without navigating away.

**Tests (Vitest)** for the comparison engine: exact match; case; punctuation; missing; extra; incorrect; multiple errors; contractions; repeated words; leading/trailing/multiple spaces; an insertion or deletion that would shift later words (including the "The boy is playing football." example from the spec: "is" missing, "the" extra, rest correct).

**Done when:** `tsc --noEmit`, lint, tests and `vite build` pass; a user can pick a difficulty, play audio, answer, see correct feedback, retry and move to the next question. Report results with real command output.

---

## Part 2 — Persistence and custom content

**Goal:** History survives reloads, and users can add their own audio exercises.

**Build**
1. Storage layer in `lib/storage` (the UI never touches IndexedDB directly). Stores: `audioBlobs`, `customLessons`, `customExercises`, `attempts`, `sessions`. Use versioned migrations. If IndexedDB is unavailable or fails, show a clear non-blocking warning and keep the app usable without persistence.
2. Practice history rules (implement exactly):
   - One `ExerciseProgress` record per exercise: `attempts` (count of checks), `bestScore`, `lastResult`, `completed` (true after the first Check, not when merely opened), `lastPracticedAt`.
   - Retrying updates the same record, not a new row per submission.
   - A session record holds start/end time, exercises attempted/completed, matched-exactly count and word-level error totals. Measure duration only from active practice (pause when the tab is hidden) or omit it.
3. Home page stats and the "Continue Practicing" action come only from stored data. Show real zeros on a fresh browser.
4. Session summary: attempted, completed, exact matches, word-level error totals, duration, Practice Again, Back to Library.
5. Custom content: import MP3/WAV/M4A (validate by MIME type and by whether the browser can decode/play it; reject others with a clear message). Store blobs in IndexedDB, never as base64 in LocalStorage. Create/edit/delete exercises (title, transcript, difficulty, audio). Several exercises may share one audio blob. Lessons contain ordered exercises with reorder and remove. Warn before deleting a lesson or audio that other exercises still reference. Validate required fields (transcript, audio, title).
6. Library: filter by difficulty and by built-in vs custom; show status (not started / in progress / completed).
7. Backup: JSON export/import of custom lesson metadata and practice history with a `schemaVersion`. Offer a separate "include audio" option and explain the file-size cost. A metadata-only export must be labeled as not containing audio. Import must never overwrite built-in content (use distinct ID namespaces) and must validate the file before writing.
8. A settings/about note: clearing browser data removes local lessons and progress.

**Tests:** create/edit/delete exercise; validation failures; shared-audio delete warning; export/import round-trip; load lesson → answer → retry → complete session → reload and see persisted progress (use `fake-indexeddb`).

**Done when:** all checks from Part 1 still pass, plus the new tests; progress persists across reloads, verified in a real browser if possible.

---

## Part 3 — Movie lesson preparation pipeline (local tool)

**Goal:** A repeatable local workflow that turns `.mkv` files into human-approved sentence clips. It must never run on Vercel or upload movies anywhere.

**Legal note to include in the README:** only use media you have the right to use, and know that publishing clips on a public site may infringe copyright even if you own the file. Mention the option of protecting the deployment (Vercel password protection) or keeping it private.

**Decisions to implement (change here if you disagree)**
- Language: Node/TypeScript scripts in `scripts/prepare-lessons`; FFmpeg/ffprobe on PATH.
- Default speech-to-text: `faster-whisper` or `whisper.cpp` run locally (free, no upload). Make the provider an interface so other providers can be added; no keys in the repo.
- Working files live in `workdir/` (git-ignored), never in `src/` or `public/`.
- Output clips: individual mono files, MP3 (or AAC/M4A) ~64 kbps, one file per sentence, with a few hundred ms of padding.

**Pipeline steps (each a CLI command, idempotent)**
1. `inspect <mkv>`: run ffprobe, list audio and subtitle tracks.
2. `extract-audio <mkv>`: extract the chosen audio track with FFmpeg.
3. `extract-subs <mkv>` or accept an external `.srt`: parse SRT into cues (write a tested parser).
4. `transcribe`: if no subtitles, run the configured STT to get text + timestamps. If it can't run, fail with a clear message; never fabricate output.
5. `segment`: build candidate sentences. One sentence = one exercise; merge cue fragments of the same sentence; split cues containing several sentences; no fixed duration; durations and word counts only produce warnings. When subtitles exist, use their text but cross-check timing against STT/alignment and flag mismatches.
6. `cut`: cut candidate clips with FFmpeg into `workdir/candidates/<difficulty>/`.
7. Write `candidates.json`: `{ id, source, difficulty, start, end, text, status: 'pending'|'approved'|'needs_correction', flags[] }`. Nothing is `approved` automatically.
8. `review`: a local review UI (small Node server + React page, localhost only) showing audio player, transcript, start/end (editable, with fine-nudge buttons and re-cut on save), source, difficulty, status and flags. Controls: edit text/times, replay, Approve, Needs correction. Flags: empty transcript, missing audio, invalid range, too short for the word count, very long silence, large subtitle/STT mismatch, duplicated text, suspiciously long sentence.
9. `validate`: fails if any clip being exported is not approved, has a flag unresolved, or lacks its audio file.
10. `export`: copy only approved clips to `public/audio/built-in/<difficulty>/` and write the production lesson index JSON. Group clips into lessons by a documented rule (e.g. per movie, N clips per lesson). Print total size and warn above a configurable budget.

**Tests:** SRT parser, segmentation logic, flag detection, timestamp validation, export refusing unapproved clips, validator catching missing audio and bad references. Use small generated fixtures, not real movies.

**Done when:** the pipeline runs end to end on a tiny test video you generate with FFmpeg (say so clearly in the report) and the tests pass. Do not claim any real movie was processed.

---

## Part 4 — Quality, deployment, docs

**Build**
1. `vercel.json`: build command `npm run build`, output `dist`, SPA rewrite to `index.html` (without breaking `/audio/*` and `/data/*`), cache headers for audio.
2. `.gitignore` and `.vercelignore` for `workdir/`, source movies and extracted audio. Add a `validate-lessons` step to the build/CI that checks every `audioPath` in the production index exists and no unapproved or sample-labeled item is in the production index by mistake.
3. Verify with `vite build` + `vite preview` that audio loads from the built asset paths, and test it in a real browser (desktop and a narrow mobile viewport). Check Safari-compatible audio formats and note that iOS needs a user gesture to start audio.
4. Accessibility pass: labels, focus order, aria-live for feedback, contrast.
5. README with: overview; features; stack; local setup; build/test commands; Vercel deployment (account, connect repo, settings, expected result); lesson data structure; adding custom audio; the full movie workflow (inspect → extract → subtitles → transcribe → segment → review → validate → export); installing FFmpeg and the STT tool; clearly separating automated steps from manual/external ones; storage limits and backup behavior; deployment size and bandwidth limits and the alternative hosting strategy if the library grows; the copyright note.

**Final report must contain:** features completed; decisions made; local run commands; exact test/lint/typecheck/build results; what still needs me (provide movies, install tools, review clips, connect Vercel); how to process the three movies; how to deploy. Do not say the site is deployed unless you actually deployed and verified it.

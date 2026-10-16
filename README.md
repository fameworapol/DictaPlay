# English Dictation

A responsive web app for practicing English listening and spelling. You hear a short clip, type the whole sentence, and get word-level feedback (correct / incorrect / missing / extra).

Everything runs client-side: no backend, no database server, no login, and no user data (answers, audio, history) ever leaves the browser.

## Features

- **Practice loop** — play/pause/replay audio at 0.5x/0.75x/1x speed, type an answer, check it, retry, move to the next question.
- **Word-level comparison engine** — case/punctuation-insensitive alignment (Levenshtein-style) that correctly handles a missing or extra word without marking every later word wrong.
- **Progress that persists** — attempts, best score, and session history are saved in the browser (IndexedDB) and survive a reload.
- **Custom content** — import your own MP3/WAV/M4A clips, build lessons from them, reorder/edit/delete.
- **Backup** — export/import your custom lessons and history as a JSON file, with or without embedded audio.
- **A local movie-to-lesson pipeline** (`scripts/prepare-lessons`) that turns a `.mkv` file into human-reviewed sentence clips — never run in the deployed app, never uploads anything.

## Stack

React 18 + TypeScript + Vite + Tailwind CSS v4 + React Router. IndexedDB (via `idb`) for user data; LocalStorage only for the playback-speed preference. Vitest + Testing Library + `fake-indexeddb` for tests. Deployed as a static site on Vercel.

## Local setup

```bash
npm install
npm run dev        # http://localhost:5173
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | `tsc --noEmit` → `validate-lessons` → `vite build` (fails the build on a type error or a bad production index) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm run lessons -- <command>` | The movie-prep CLI (see below) |
| `npm run validate-lessons` | Checks `public/data/lessons-index.json` on its own |

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In the Vercel dashboard, **Add New → Project**, and import the repo.
3. Vercel will detect `vercel.json`: build command `npm run build`, output directory `dist`. No environment variables are needed — there's no backend.
4. Deploy. You'll get a `*.vercel.app` URL serving the static site.

`vercel.json` also configures:
- An SPA rewrite so client-side routes like `/library` or `/practice/:id` work on a hard refresh, **without** intercepting `/audio/*`, `/data/*`, or the built `/assets/*` — those are served as real files.
- A one-year `immutable` cache header on `/audio/*`. If you re-export a corrected clip under the **same** filename, browsers/CDNs that already cached it won't see the update for up to a year — give a corrected clip a new id (filename) instead of reusing the old one, or purge the cache manually.
- A short (5 min) cache on `/data/*` so a new lesson index shows up promptly.

Given the real movie dialogue and copyright considerations below, also consider **Vercel's password protection** on the deployment, or simply keeping the project private, before pointing anyone else at the URL.

### Deployment size / bandwidth

Vercel's free tier has deployment size and monthly bandwidth limits. The sample audio alone is ~180 KB; real movie-derived audio at ~64 kbps mono adds up fast if you export many clips — budget roughly 25–30 KB per 3-second sentence clip. `npm run lessons -- export` prints the total exported size and warns if it crosses a configurable budget (`--budget-mb`, default 150 MB). If your library grows past what fits comfortably in a single static deploy, move audio to an object store with a CDN in front of it (e.g. Cloudflare R2, S3 + CloudFront, Bunny Storage) and change `audioPath` to point at that CDN's URL instead of `/audio/...` — the app only needs a URL it can `fetch`/play, so this requires no app-code changes beyond the index.

## Lesson data structure

The production lesson index is fetched at runtime (not bundled into the JS) from `public/data/lessons-index.json`:

```ts
interface Lesson {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  source: 'builtin' | 'custom'
  exerciseIds: string[]
}

interface Exercise {
  id: string
  lessonId: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  audioPath?: string     // built-in/sample exercises: relative path under /public
  audioBlobId?: string   // custom exercises: id of a Blob in the audioBlobs IndexedDB store
  transcript: string
  sourceId?: string       // present only on sample/demo content, so the UI can label it "Sample"
}
```

Two separate audio folders, by design (hard constraint: sample content must live apart from production content):
- `public/audio/sample/<difficulty>/` — the 9 text-to-speech sample clips from Part 1, always labeled "Sample" in the UI.
- `public/audio/built-in/<difficulty>/` — real, human-approved clips exported by the movie pipeline.

`npm run validate-lessons` (also run automatically as part of `npm run build`) checks the index for dangling lesson/exercise references, missing audio files, and — specifically — that nothing under `audio/sample/` is missing its `sourceId` label and nothing under `audio/built-in/` has one it shouldn't (either mistake would mislabel content in the UI).

## Adding custom audio (in the app, no tools needed)

Go to **My Content** → New lesson → Add exercise → pick an MP3/WAV/M4A file. The file is validated by MIME type and by whether the browser can actually decode it, then stored as a Blob in IndexedDB (never as base64 in LocalStorage). Several exercises can share one audio blob; deleting an exercise whose audio is still used elsewhere keeps the audio and just removes that one exercise, with a warning shown first.

## Storage limits and backup

All custom lessons, audio, and practice history live only in this browser's IndexedDB. There's no fixed quota in this app — it's whatever the browser grants the site (commonly hundreds of MB to several GB, browser-dependent), and the app shows a non-blocking warning if IndexedDB is unavailable or fails, while staying usable without persistence.

**Clearing your browser's site data for this app deletes your custom lessons and progress.** Use **Settings → Export backup** first. A backup is a JSON file with a `schemaVersion`:
- **Metadata-only** export (default): lessons, exercises, and history, but no audio — much smaller, but importing it elsewhere will show those exercises as missing audio until you re-attach it.
- **Include audio**: embeds each clip as base64 inside the JSON. Much larger, but a full, self-contained restore.

Importing never touches built-in/sample content — custom ids always use a `custom-` prefix, a structurally separate namespace — and the file is validated (schema version, shape) before anything is written.

## The movie lesson pipeline (local only — never runs on Vercel, never uploads anything)

> **Legal note:** only run this against media you have the right to use. Publishing clips from a copyrighted film on a public site can infringe copyright even if you legitimately own the source file. If you deploy real movie-derived content, consider Vercel's password protection or keeping the deployment private.

### Install the tools (manual, external — not automated by this repo)

- **FFmpeg / ffprobe**, on PATH. macOS: `brew install ffmpeg`.
- **A local speech-to-text tool** — only needed for a movie that has **no usable subtitles**. The default documented provider is the `whisper` CLI (`pip install -U openai-whisper`, requires Python). This never uploads audio anywhere; it's a local subprocess. If it isn't installed, `transcribe` fails with a clear message — it is never simulated or faked.

### Automated steps (run locally with `npm run lessons -- <command>`)

| Step | What it does |
|---|---|
| `inspect <mkv>` | Lists audio/subtitle tracks via ffprobe |
| `extract-audio <mkv> --source <id> --stream <n>` | Decodes the chosen audio track to `workdir/<id>/audio.wav` |
| `extract-subs <mkv> --source <id> --stream <n>` (or `--from <file.srt>`) | Gets subtitles — from the file, or an external `.srt` you already have |
| `transcribe --source <id>` | Only if there are no usable subtitles — runs the local STT tool |
| `segment --source <id> --difficulty <easy\|medium\|hard>` | Merges fragmented subtitle cues into whole sentences, splits cues with multiple sentences, flags anything questionable (empty transcript, invalid timing, pace too fast for the word count, a long sentence, a duplicate line), writes `workdir/candidates.json` with every candidate `status: "pending"` — **nothing is approved automatically** |
| `cut --source <id>` | Cuts each candidate to its own mono AAC clip (~64 kbps, ~300 ms padding) in `workdir/<id>/candidates/<difficulty>/`, and flags a long silent span if ffmpeg's silence detector finds one |
| `validate` | Fails if any **approved** clip has an unresolved flag or missing audio |
| `export` | Runs `validate` first; copies only approved clips into `public/audio/built-in/<difficulty>/` and writes/merges the production lesson index; prints the total exported size and warns past `--budget-mb` (default 150) |

Lessons are grouped per source movie, in chronological (scene) order, chunked at 8 exercises per lesson — see `scripts/prepare-lessons/export.ts` if you want a different rule.

### The one step that needs a human

`npm run lessons -- review [--port 4321]` starts a **localhost-only** Node server with a small React review page (nothing is exposed beyond your machine). For each candidate it shows the audio, the transcript (editable), start/end times (editable, with ±0.1s/±0.5s nudge buttons that re-cut the clip on save), the flags, and two buttons: **Approve** / **Needs correction**. This step is genuinely manual — reviewing whether a clip is a clean, correctly-timed sentence is a judgment call this tool does not make for you, and the pipeline's own honesty rule is that nothing gets approved without it.

### Processing the three provided movies

Local-only; the actual clips and intermediate files are never committed (`workdir/` and `*.mkv` are git-ignored). For each of `movie/easy/Toy_Story_5.mkv`, `movie/medium/The_Intern.mkv`, `movie/hard/The_Social_Network.mkv` (all three already have embedded English subtitles, so `transcribe` isn't needed):

```bash
npm run lessons -- extract-audio movie/easy/Toy_Story_5.mkv --source Toy_Story_5 --stream 1
npm run lessons -- extract-subs   movie/easy/Toy_Story_5.mkv --source Toy_Story_5 --stream 2
npm run lessons -- segment --source Toy_Story_5 --difficulty easy
npm run lessons -- cut --source Toy_Story_5
# repeat for The_Intern (medium, stream 1 audio / stream 2 subs) and The_Social_Network (hard, same streams)

npm run lessons -- review          # approve the sentences you actually want as lessons
npm run lessons -- validate
npm run lessons -- export
```

## Testing

```bash
npm run test
```

95 tests covering: the comparison engine (normalization, alignment, the documented tie-break rule, contractions, repeated/shifted words); the movie pipeline (SRT parsing, sentence segmentation, flag detection, validate/export logic) against small generated fixtures, never real movies; the storage layer (create/edit/delete, validation failures, the shared-audio delete warning, export/import round-trip, progress surviving a simulated reload) via `fake-indexeddb`; and the production-index validator.

## Accessibility

Labeled form controls, a skip-to-content link, visible focus rings, `aria-live` on the word-level feedback (plus a screen-reader-only summary sentence), status/error regions use `role="alert"`/`role="status"`, and feedback never relies on color alone (✓ / ≠ / − / + symbols plus text). Verified with an automated `axe-core` pass (zero WCAG2A/AA violations) across Home, Library, Practice (both before and after checking an answer), Summary, My Content, and Settings, plus a real-browser check at a 375px mobile viewport (no horizontal scroll) and a desktop viewport.

Safari/iOS: audio clips are AAC-in-M4A, which Safari and iOS both play natively. iOS requires a user gesture to start audio — the player only ever calls `.play()` from a click handler (the Play/Replay buttons), never automatically.

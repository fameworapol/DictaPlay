import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { candidatesPathFor, readCandidates, writeCandidates } from '../candidates'
import { cutClip, detectSilenceDurations } from '../ffmpeg'
import { candidateClipPath, sourceAudioPath } from '../paths'
import type { CandidateClip, CandidateStatus } from '../types'

const clientEntry = fileURLToPath(new URL('./client/main.tsx', import.meta.url))

async function bundleClient(): Promise<string> {
  const result = await build({
    entryPoints: [clientEntry],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
  })
  return result.outputFiles[0].text
}

function renderHtml(script: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lesson Review (localhost only)</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
</style>
</head>
<body>
<div id="root"></div>
<script>${script}</script>
</body>
</html>`
}

interface PatchBody {
  text?: string
  start?: number
  end?: number
  status?: CandidateStatus
}

function readJsonBody(req: IncomingMessage): Promise<PatchBody> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? (JSON.parse(data) as PatchBody) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/** Local-only review UI: a Node HTTP server + React page, bound to 127.0.0.1. */
export async function startReviewServer(workdir: string, port: number): Promise<void> {
  const clientJs = await bundleClient()
  const html = renderHtml(clientJs)

  const server = createServer((req, res) => {
    void handleRequest(req, res, workdir, html)
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`Review UI running at http://127.0.0.1:${port} (localhost only — never exposed).`)
  })
}

async function handleRequest(
  req: IncomingMessage,
  res: import('node:http').ServerResponse,
  workdir: string,
  html: string
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/candidates') {
      const file = await readCandidates(candidatesPathFor(workdir))
      const enriched = file.candidates.map((c) => ({
        ...c,
        audioAvailable: existsSync(candidateClipPath(workdir, c)),
      }))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(enriched))
      return
    }

    const audioMatch = url.pathname.match(/^\/api\/audio\/(.+)$/)
    if (req.method === 'GET' && audioMatch) {
      const id = decodeURIComponent(audioMatch[1])
      const file = await readCandidates(candidatesPathFor(workdir))
      const candidate = file.candidates.find((c) => c.id === id)
      if (!candidate) return notFound(res)
      const clipPath = candidateClipPath(workdir, candidate)
      if (!existsSync(clipPath)) return notFound(res, 'audio missing')
      const data = await readFile(clipPath)
      res.writeHead(200, { 'content-type': 'audio/mp4' })
      res.end(data)
      return
    }

    if (req.method === 'PATCH' && url.pathname.startsWith('/api/candidates/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/candidates/', ''))
      const body = await readJsonBody(req)
      const file = await readCandidates(candidatesPathFor(workdir))
      const candidate = file.candidates.find((c) => c.id === id)
      if (!candidate) return notFound(res)

      const timingChanged =
        (body.start !== undefined && body.start !== candidate.start) ||
        (body.end !== undefined && body.end !== candidate.end)

      if (body.text !== undefined) candidate.text = body.text
      if (body.start !== undefined) candidate.start = body.start
      if (body.end !== undefined) candidate.end = body.end
      if (body.status !== undefined) candidate.status = body.status

      if (timingChanged) {
        await recutAndReflag(workdir, candidate)
      }

      await writeCandidates(candidatesPathFor(workdir), file)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(candidate))
      return
    }

    notFound(res)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end(error instanceof Error ? error.message : 'Internal error')
  }
}

async function recutAndReflag(workdir: string, candidate: CandidateClip): Promise<void> {
  const audioPath = sourceAudioPath(workdir, candidate.source)
  const outPath = candidateClipPath(workdir, candidate)
  candidate.flags = candidate.flags.filter(
    (f) => f !== 'invalid_range' && f !== 'long_silence' && f !== 'missing_audio'
  )

  if (!(candidate.end > candidate.start) || candidate.start < 0) {
    candidate.flags.push('invalid_range')
    return
  }
  if (!existsSync(audioPath)) {
    candidate.flags.push('missing_audio')
    return
  }

  await cutClip({ sourceWavPath: audioPath, start: candidate.start, end: candidate.end, paddingSeconds: 0.3, outPath })
  const silences = await detectSilenceDurations(outPath)
  if (silences.some((d) => d >= 1.5)) candidate.flags.push('long_silence')
}

function notFound(res: import('node:http').ServerResponse, message = 'not found'): void {
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end(message)
}

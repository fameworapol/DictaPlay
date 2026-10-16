#!/usr/bin/env node
import {
  cutCommand,
  deriveSourceId,
  exportCommand,
  extractAudioCommand,
  extractSubsCommand,
  inspectCommand,
  pruneByFlagCommand,
  segmentCommand,
  transcribeCommand,
  validateCommand,
} from './commands'
import { projectRoot } from './paths'
import type { CandidateFlag, Difficulty } from './types'

const WORKDIR = `${projectRoot}workdir`
const PUBLIC_AUDIO_DIR = `${projectRoot}public/audio/built-in`
const LESSONS_INDEX_PATH = `${projectRoot}public/data/lessons-index.json`

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}

function usage(): never {
  console.log(`Usage: npm run lessons -- <command> [args]

Commands:
  inspect <mkv>
  extract-audio <mkv> --source <id> --stream <index>
  extract-subs [<mkv>] --source <id> [--stream <index>] [--from <srt>]
  transcribe --source <id>
  segment --source <id> --difficulty <easy|medium|hard> [--force] [--target-seconds 10]
  cut --source <id>
  prune --flag <flagName> [--source <id>]
  review [--port 4321]
  validate
  export [--budget-mb 150]

Working files live in workdir/ (git-ignored). Nothing is approved
automatically — use "review" before "validate"/"export".`)
  process.exit(1)
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  if (!command) usage()

  switch (command) {
    case 'inspect': {
      const mkvPath = rest[0]
      if (!mkvPath) usage()
      await inspectCommand(mkvPath)
      return
    }
    case 'extract-audio': {
      const mkvPath = rest[0]
      const source = flag(rest, 'source') ?? (mkvPath ? deriveSourceId(mkvPath) : undefined)
      const streamIndex = flag(rest, 'stream')
      if (!mkvPath || !source || streamIndex === undefined) usage()
      await extractAudioCommand(mkvPath, source, Number(streamIndex), WORKDIR)
      return
    }
    case 'extract-subs': {
      const fromSrt = flag(rest, 'from')
      const mkvPath = rest[0]?.startsWith('--') ? null : (rest[0] ?? null)
      const source = flag(rest, 'source') ?? (mkvPath ? deriveSourceId(mkvPath) : undefined)
      const streamIndex = flag(rest, 'stream')
      if (!source) usage()
      await extractSubsCommand(mkvPath, source, WORKDIR, {
        streamIndex: streamIndex === undefined ? undefined : Number(streamIndex),
        fromSrtPath: fromSrt,
      })
      return
    }
    case 'transcribe': {
      const source = flag(rest, 'source')
      if (!source) usage()
      await transcribeCommand(source, WORKDIR)
      return
    }
    case 'segment': {
      const source = flag(rest, 'source')
      const difficulty = flag(rest, 'difficulty') as Difficulty | undefined
      const force = rest.includes('--force')
      const targetSecondsFlag = flag(rest, 'target-seconds')
      if (!source || !difficulty) usage()
      await segmentCommand(source, difficulty, WORKDIR, {
        force,
        targetSeconds: targetSecondsFlag === undefined ? undefined : Number(targetSecondsFlag),
      })
      return
    }
    case 'cut': {
      const source = flag(rest, 'source')
      if (!source) usage()
      await cutCommand(source, WORKDIR)
      return
    }
    case 'prune': {
      const flagName = flag(rest, 'flag') as CandidateFlag | undefined
      const source = flag(rest, 'source')
      if (!flagName) usage()
      await pruneByFlagCommand(WORKDIR, flagName, source)
      return
    }
    case 'review': {
      const port = Number(flag(rest, 'port') ?? 4321)
      const { startReviewServer } = await import('./review-server/server')
      await startReviewServer(WORKDIR, port)
      return
    }
    case 'validate': {
      const ok = await validateCommand(WORKDIR)
      process.exitCode = ok ? 0 : 1
      return
    }
    case 'export': {
      const budgetMb = Number(flag(rest, 'budget-mb') ?? 150)
      await exportCommand(WORKDIR, PUBLIC_AUDIO_DIR, LESSONS_INDEX_PATH, budgetMb)
      return
    }
    default:
      usage()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

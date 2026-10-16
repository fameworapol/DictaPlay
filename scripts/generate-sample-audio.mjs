#!/usr/bin/env node
/**
 * Generates the sample/demo exercise audio using macOS's built-in `say` (TTS)
 * and `afconvert` (both ship with macOS, no install required). FFmpeg is the
 * documented default in the project spec, but it isn't installed on this
 * machine, so `afconvert` is used instead to produce the same AAC-in-M4A
 * output without adding a dependency. Re-run this any time SAMPLE_EXERCISES
 * below changes. Output is for the "Sample" lessons only — never real movie
 * audio.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = (difficulty) => join(projectRoot, 'public', 'audio', 'built-in', difficulty)

const SAMPLE_EXERCISES = [
  { id: 'ex-001', difficulty: 'easy', text: 'The boy is playing football.' },
  { id: 'ex-002', difficulty: 'easy', text: 'I like to eat apples.' },
  { id: 'ex-003', difficulty: 'easy', text: 'She is reading a book.' },
  { id: 'ex-004', difficulty: 'medium', text: 'Despite the rain, they decided to go for a walk.' },
  { id: 'ex-005', difficulty: 'medium', text: "He couldn't find his keys this morning." },
  { id: 'ex-006', difficulty: 'medium', text: 'The meeting has been rescheduled to next Friday.' },
  {
    id: 'ex-007',
    difficulty: 'hard',
    text: "Notwithstanding the committee's reservations, the proposal was approved unanimously.",
  },
  {
    id: 'ex-008',
    difficulty: 'hard',
    text: "She wouldn't have missed the flight if the traffic hadn't been so unpredictable.",
  },
  {
    id: 'ex-009',
    difficulty: 'hard',
    text: 'The researchers’ findings, though preliminary, suggest a correlation between sleep and memory retention.',
  },
]

for (const difficulty of ['easy', 'medium', 'hard']) {
  mkdirSync(outDir(difficulty), { recursive: true })
}

for (const { id, difficulty, text } of SAMPLE_EXERCISES) {
  const aiffPath = join(tmpdir(), `${id}.aiff`)
  const m4aPath = join(outDir(difficulty), `${id}.m4a`)

  execFileSync('say', ['-v', 'Samantha', '-r', '170', '-o', aiffPath, text])
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', aiffPath, m4aPath])
  rmSync(aiffPath, { force: true })

  console.log(`generated ${m4aPath}`)
}

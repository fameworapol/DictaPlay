#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { LessonIndex } from '../../src/types/lesson'
import { validateProductionIndex } from './validator'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const indexPath = `${projectRoot}public/data/lessons-index.json`
const publicDir = `${projectRoot}public`

function main() {
  if (!existsSync(indexPath)) {
    console.error(`Production lesson index not found at ${indexPath}`)
    process.exitCode = 1
    return
  }

  const index = JSON.parse(readFileSync(indexPath, 'utf-8')) as LessonIndex
  const issues = validateProductionIndex(index, (relativePath) => existsSync(`${publicDir}/${relativePath}`))

  console.log(`Checked ${index.lessons.length} lesson(s), ${index.exercises.length} exercise(s).`)

  if (issues.length === 0) {
    console.log('validate-lessons passed.')
    return
  }

  console.error(`validate-lessons found ${issues.length} issue(s):`)
  for (const issue of issues) console.error(`  - ${issue.message}`)
  process.exitCode = 1
}

main()

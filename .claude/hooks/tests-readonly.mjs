#!/usr/bin/env node
// PreToolUse: block Edit/Write on test paths while an implement-feature run
// is between its red checkpoint and completion. Exit 2 blocks; exit 0 allows.
//
// implement-feature step 3 writes the red-checkpoint SHA to
//   $(git rev-parse --git-path implement-feature-red)
// and step 7 removes it. The marker only counts while that SHA is an ancestor of HEAD
// and not yet on the default branch, so a stale marker never blocks later work.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TEST_PATH =
  /(^|[\\/])(tests?|__tests__|e2e)[\\/]|\.(test|spec)\.[cm]?[jt]sx?$|(^|[\\/])test_[^\\/]*\.py$/

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0) // unreadable input: the step 7 diff gate is the backstop
}

const input = payload.tool_input ?? {}
const target = input.file_path ?? input.notebook_path ?? ''
if (!target || !TEST_PATH.test(target)) process.exit(0)

const cwd = payload.cwd || process.cwd()
const git = (...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const isAncestor = (a, b) => {
  try {
    git('merge-base', '--is-ancestor', a, b)
    return true
  } catch {
    return false
  }
}

let marker
try {
  marker = resolve(cwd, git('rev-parse', '--git-path', 'implement-feature-red'))
} catch {
  process.exit(0) // not a git checkout
}
if (!existsSync(marker)) process.exit(0)

const red = readFileSync(marker, 'utf8').trim()
if (!red || !isAncestor(red, 'HEAD')) process.exit(0) // stale: other branch or abandoned run

let base = ''
try {
  base = git('rev-parse', '--abbrev-ref', 'origin/HEAD')
} catch {
  base = '' // no origin/HEAD: treat as unmerged
}
if (base && isAncestor(red, base)) process.exit(0) // already merged

process.stderr.write(`BLOCKED: ${payload.tool_name ?? 'edit'} on a test file during implement-feature.

  ${target}

Red checkpoint ${red.slice(0, 12)} froze these tests as the contract. If a test
is genuinely wrong, stop and raise it with the human; do not edit it here.
The run ends at implement-feature step 7, which removes:
  ${marker}
`)
process.exit(2)

// pr-ready 128 (pure part): the real GithubPort asks `gh pr view <url> --json
// state,mergeable,headRefOid,statusCheckRollup` with an argument array (no shell) and maps the
// answer to PrStatus: a CheckRun keeps its name, status and conclusion (a run that is not
// COMPLETED is PENDING); a StatusContext becomes name = context, PENDING for PENDING or EXPECTED,
// else COMPLETED with the state as its conclusion. Driven with node as the "gh" executable and a
// fake script as its first argument (prefixArgs); the real gh is never run.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ghPort } from '../packages/agent/src/github.ts'

const URL = 'https://github.com/jamesdavisonio/kanban/pull/36'

// A fake gh that records its argv and prints `answer` as JSON.
function fakeGh(answer: unknown): { port: ReturnType<typeof ghPort>; argv: () => string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'pr-ready-gh-'))
  const file = join(dir, 'fake-gh.cjs')
  writeFileSync(
    file,
    `const fs = require('fs'), path = require('path');
fs.writeFileSync(path.join(__dirname, 'argv.json'), JSON.stringify(process.argv.slice(2)));
console.log(JSON.stringify(${JSON.stringify(answer)}));`
  )
  return {
    port: ghPort({ command: process.execPath, prefixArgs: [file] }),
    argv: () => JSON.parse(readFileSync(join(dir, 'argv.json'), 'utf8')) as string[],
  }
}

const rollup = (items: unknown[], over: Record<string, unknown> = {}) => ({
  state: 'OPEN',
  mergeable: 'MERGEABLE',
  headRefOid: 'abc123def',
  statusCheckRollup: items,
  ...over,
})

describe('pr-ready 128: the real GithubPort', () => {
  it('runs gh pr view <url> --json … as an argument array after prefixArgs', async () => {
    const gh = fakeGh(rollup([]))
    await gh.port.prStatus(URL)
    expect(gh.argv().slice(-5)).toEqual([
      'pr',
      'view',
      URL,
      '--json',
      'state,mergeable,headRefOid,statusCheckRollup',
    ])
  })

  it('a url full of shell syntax is one argument and runs nothing', async () => {
    const evil = `${URL}; echo x > pwned & $(touch pwned2)`
    const gh = fakeGh(rollup([]))
    await gh.port.prStatus(evil)
    expect(gh.argv()).toContain(evil)
    expect(existsSync(join(process.cwd(), 'pwned'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'pwned2'))).toBe(false)
  })

  it('maps state, mergeable and the head commit', async () => {
    for (const [state, mergeable] of [
      ['OPEN', 'MERGEABLE'],
      ['MERGED', 'UNKNOWN'],
      ['CLOSED', 'CONFLICTING'],
    ] as const) {
      const got = await fakeGh(rollup([], { state, mergeable })).port.prStatus(URL)
      expect(got).toMatchObject({ state, mergeable, head: 'abc123def', checks: [] })
    }
  })

  it('maps check runs: completed ones keep their conclusion, unfinished ones are PENDING', async () => {
    const got = await fakeGh(
      rollup([
        { __typename: 'CheckRun', name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { __typename: 'CheckRun', name: 'docs', status: 'COMPLETED', conclusion: 'SKIPPED' },
        { __typename: 'CheckRun', name: 'e2e', status: 'COMPLETED', conclusion: 'FAILURE' },
        { __typename: 'CheckRun', name: 'fast-feedback', status: 'IN_PROGRESS', conclusion: '' },
        { __typename: 'CheckRun', name: 'queued', status: 'QUEUED', conclusion: '' },
      ])
    ).port.prStatus(URL)
    expect(got.checks.map((c) => [c.name, c.status])).toEqual([
      ['build', 'COMPLETED'],
      ['docs', 'COMPLETED'],
      ['e2e', 'COMPLETED'],
      ['fast-feedback', 'PENDING'],
      ['queued', 'PENDING'],
    ])
    expect(got.checks.slice(0, 3).map((c) => c.conclusion)).toEqual([
      'SUCCESS',
      'SKIPPED',
      'FAILURE',
    ])
  })

  it('maps status contexts: name is the context; PENDING and EXPECTED are pending, others completed', async () => {
    const got = await fakeGh(
      rollup([
        { __typename: 'StatusContext', context: 'ci/ok', state: 'SUCCESS' },
        { __typename: 'StatusContext', context: 'ci/bad', state: 'FAILURE' },
        { __typename: 'StatusContext', context: 'ci/err', state: 'ERROR' },
        { __typename: 'StatusContext', context: 'ci/wait', state: 'PENDING' },
        { __typename: 'StatusContext', context: 'ci/exp', state: 'EXPECTED' },
      ])
    ).port.prStatus(URL)
    expect(got.checks.map((c) => [c.name, c.status])).toEqual([
      ['ci/ok', 'COMPLETED'],
      ['ci/bad', 'COMPLETED'],
      ['ci/err', 'COMPLETED'],
      ['ci/wait', 'PENDING'],
      ['ci/exp', 'PENDING'],
    ])
    expect(got.checks.slice(0, 3).map((c) => c.conclusion)).toEqual(['SUCCESS', 'FAILURE', 'ERROR'])
  })

  it('an empty rollup is no checks', async () => {
    expect((await fakeGh(rollup([])).port.prStatus(URL)).checks).toEqual([])
  })
})

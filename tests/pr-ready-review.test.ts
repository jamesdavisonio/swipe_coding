// Added after the freeze with James's approval ("another round", 2026-11-09): the default GitHub
// port never runs gh while tests run against the Firestore emulator (suites that start a notifier
// without a port rely on it). PATH is emptied, so a spawned gh would fail with ENOENT.
import { afterEach, describe, expect, it } from 'vitest'
import { ghPort } from '../packages/agent/src/github.ts'

const saved = { path: process.env.PATH, host: process.env.FIRESTORE_EMULATOR_HOST }
afterEach(() => {
  process.env.PATH = saved.path
  if (saved.host === undefined) delete process.env.FIRESTORE_EMULATOR_HOST
  else process.env.FIRESTORE_EMULATOR_HOST = saved.host
})

describe('pr-ready review: the default GitHub port under the emulator', () => {
  it('answers every PR as open, mergeable unknown, no checks, without running gh', async () => {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
    process.env.PATH = ''
    const answer = await ghPort().prStatus('https://github.com/jamesdavisonio/kanban/pull/1')
    expect(answer).toEqual({ state: 'OPEN', mergeable: 'UNKNOWN', head: '', checks: [] })
  })
})

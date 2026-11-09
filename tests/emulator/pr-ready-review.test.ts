// Added after the freeze with James's approval ("another round", 2026-11-09), for the review's
// hole: a push while a PR is pending must restart the no-checks grace for the new head, so a
// read made before the new head's checks registered never shows a merge card.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adminDb,
  barrier,
  clearPrData,
  clock,
  fakeGithub,
  polledTimes,
  prTask,
  prUrl,
  PR_GRACE_MS,
  readTask,
  running,
  startReady,
  status,
  stopAll,
  waitFor,
  waitForTask,
  type Db,
} from '../fixtures/pr-ready-emulator.ts'

let db: Db
const github = fakeGithub()
beforeAll(async () => {
  db = await adminDb()
})
beforeEach(async () => {
  await stopAll()
  await clearPrData(db)
  github.reset()
  clock.t = Date.now()
})
afterAll(async () => {
  await stopAll()
  await clearPrData(db)
})

describe('a new head while pending', () => {
  it('waits noChecksGraceMs after the new head was first seen before passing with no checks', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [running('build')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 1)
    clock.t += 2 * PR_GRACE_MS
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    // The push: GitHub has recomputed mergeable, the new head's checks have not registered yet.
    github.answer(url, status({ head: 'h2', mergeable: 'MERGEABLE', checks: [] }))
    // Two more reads of h2, or the task left pending (the bug): whichever comes first.
    const from = github.count(url)
    await waitFor(
      async () =>
        github.count(url) >= from + 3 || (await readTask(db, task.id)).pr?.checks !== 'pending',
      'h2 read twice or the task moved'
    )
    await barrier(db, github)
    expect((await readTask(db, task.id)).pr?.checks).toBe('pending')
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += PR_GRACE_MS - 1
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += 1
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr).toMatchObject({ checks: 'passed', head: 'h2' })
  })

  it('after a restart, a head other than the one the task records counts from its first read', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h2', mergeable: 'MERGEABLE', checks: [] }))
    const task = await prTask(db, url, {}, { head: 'h1', pendingSince: clock.t - 10 * PR_GRACE_MS })
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += PR_GRACE_MS
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr).toMatchObject({ checks: 'passed', head: 'h2' })
  })
})

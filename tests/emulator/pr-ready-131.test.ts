// pr-ready 131 in the Firestore emulator (`npm run test:rules`): after a failure, a new run of the
// PR's checks (a push, so a new head commit) is watched again: the task goes back to pending
// (pendingSince reset) and then passes (128) or fails (130) as before. A failure is reported once
// per run (per head commit), however often it is read.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adminDb,
  clearPrData,
  clock,
  done,
  fakeGithub,
  MINUTE,
  ok,
  polledTimes,
  prNumber,
  prTask,
  prUrl,
  readComments,
  readTask,
  running,
  startReady,
  status,
  stopAll,
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

const bodies = async (id: string, prefix: string) =>
  (await readComments(db, id)).filter((c) => String(c.body).startsWith(prefix)).map((c) => c.body)

describe('pr-ready 131: a new run after a failure', () => {
  it('reading the same failed run again reports it once', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    await polledTimes(db, github, url, 4)
    expect(await bodies(task.id, 'Checks failed')).toEqual([
      `Checks failed on PR #${prNumber(url)}: build`,
    ])
  })

  it('a push puts it back to pending (pendingSince reset), then the new run passes', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    clock.t += 10 * MINUTE
    github.answer(url, status({ head: 'h2', checks: [running('build')] }))
    const pending = await waitForTask(
      db,
      task.id,
      (x) => x.pr?.checks === 'pending',
      'pending again'
    )
    expect(pending.needs).toBeNull()
    expect(pending.pr?.pendingSince).toBe(clock.t)
    expect(pending.pr?.head).toBe('h2')
    github.answer(url, status({ head: 'h2', checks: [ok('build')] }))
    const passed = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(passed.pr).toMatchObject({ checks: 'passed', head: 'h2' })
    expect(await bodies(task.id, 'Checks failed')).toHaveLength(1)
  })

  it('the next run failing again is reported again, once, with its own names', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    github.answer(
      url,
      status({ head: 'h2', checks: [done('lint', 'CANCELLED'), running('build')] })
    )
    await waitForTask(
      db,
      task.id,
      (x) => x.pr?.checks === 'failed' && x.pr.head === 'h2',
      'the second failure'
    )
    await polledTimes(db, github, url, 3)
    const n = prNumber(url)
    expect(await bodies(task.id, 'Checks failed')).toEqual([
      `Checks failed on PR #${n}: build`,
      `Checks failed on PR #${n}: lint`,
    ])
    expect((await readTask(db, task.id)).needs).toBeNull()
  })

  it('the same head running its checks again goes back to pending, and a new failure is reported again', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    clock.t += 5 * MINUTE
    github.answer(url, status({ head: 'h1', checks: [running('build')] }))
    const pending = await waitForTask(db, task.id, (x) => x.pr?.checks === 'pending', 'pending')
    expect(pending.needs).toBeNull()
    expect(pending.pr?.pendingSince).toBe(clock.t)
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed again')
    await polledTimes(db, github, url, 3)
    const n = prNumber(url)
    expect(await bodies(task.id, 'Checks failed')).toEqual([
      `Checks failed on PR #${n}: build`,
      `Checks failed on PR #${n}: build`,
    ])
    expect(await bodies(task.id, 'Checks running')).toHaveLength(2)
  })

  it('each new head says "Checks running" once, and the failed task stays watched', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [running('build')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    const calls = github.count(url)
    await polledTimes(db, github, url, 2) // still reading a failed task
    expect(github.count(url)).toBeGreaterThan(calls)
    github.answer(url, status({ head: 'h2', checks: [running('build')] }))
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'pending', 'pending again')
    await polledTimes(db, github, url, 2)
    expect(await bodies(task.id, 'Checks running')).toHaveLength(2)
  })
})

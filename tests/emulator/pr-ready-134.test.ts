// pr-ready 134 in the Firestore emulator (`npm run test:rules`): a merge card that appears (128)
// notifies every device once per PR head, like a decision card: titled "Merge · <project>", the
// task's title as its text, tagged and linked as decision cards are. A failed run, a PR still
// pending, and a restart of the notifier send nothing more.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDevices,
  seedDevices,
  sentFor,
  settle,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'
import {
  adminDb,
  clearPrData,
  clock,
  done,
  fakeGithub,
  NOTIFIER_PROJECT,
  ok,
  polledTimes,
  prTask,
  prUrl,
  push,
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
  push.reset()
  clock.t = Date.now()
  await seedDevices(db, ['tok-a', 'tok-b'])
})
afterAll(async () => {
  await stopAll()
  await clearPrData(db)
  await clearDevices(db)
})

describe('pr-ready 134: the merge notification', () => {
  it('a card that appears notifies the devices: "Merge · <project>", the task title, the usual tag and link', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [ok('build')] }))
    const task = await prTask(db, url, { title: 'Add the search page' })
    await startReady(db, github)
    const calls = await waitForSends(push, task.id, 1)
    expect(calls).toHaveLength(1)
    expect(calls[0].tokens.sort()).toEqual(['tok-a', 'tok-b'])
    expect(calls[0].notice).toMatchObject({
      title: `Merge · ${NOTIFIER_PROJECT.name}`,
      body: 'Add the search page',
      tag: `decision:${task.id}`,
      url: `/?task=${task.id}`,
    })
  })

  it('nothing is sent while the checks run or after they failed', async () => {
    const running1 = prUrl()
    const failed1 = prUrl()
    github.answer(running1, status({ checks: [running('build')] }))
    github.answer(failed1, status({ checks: [done('build', 'FAILURE')] }))
    const a = await prTask(db, running1)
    const b = await prTask(db, failed1)
    await startReady(db, github)
    await waitForTask(db, b.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    await polledTimes(db, github, running1, 3)
    await settle(db, push)
    expect(sentFor(push, a.id)).toHaveLength(0)
    expect(sentFor(push, b.id)).toHaveLength(0)
  })

  it('a failure then a passing new run: one notification, for the run that passed', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [done('build', 'FAILURE')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    github.answer(url, status({ head: 'h2', checks: [ok('build')] }))
    await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    await waitForSends(push, task.id, 1)
    await settle(db, push)
    expect(sentFor(push, task.id)).toHaveLength(1)
  })

  it('a restarted notifier does not notify the same PR again', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'h1', checks: [ok('build')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await waitForSends(push, task.id, 1)
    await stopAll()
    await startReady(db, github)
    await settle(db, push)
    expect(sentFor(push, task.id)).toHaveLength(1)
  })
})

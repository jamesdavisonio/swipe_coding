// pr-ready 129 in the Firestore emulator (`npm run test:rules`): a task whose need becomes `pr`
// while its PR's checks are not known to have passed (a session on an older agent sets the need
// directly) is treated as in 127: the notifier clears the need, sets pr.checks 'pending' and
// watches it. Nothing is notified for the cleared need. A need on a PR whose checks already passed
// is left alone.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clearDevices, seedDevices, sentFor } from '../fixtures/board-briefs-b7-emulator.ts'
import {
  adminDb,
  barrier,
  clearPrData,
  clock,
  fakeGithub,
  ok,
  patchTask,
  polledTimes,
  prNumber,
  prUrl,
  push,
  putTask,
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
  push.reset()
  clock.t = Date.now()
  await seedDevices(db, ['tok-a'])
})
afterAll(async () => {
  await stopAll()
  await clearPrData(db)
  await clearDevices(db)
})

describe('pr-ready 129: an older session setting the merge need directly', () => {
  it('a merge need with no checks recorded is cleared and watched, with nothing notified', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [running('fast-feedback')] }))
    const task = await putTask(db, {
      stage: 'pr',
      needs: { kind: 'pr' },
      pr: { number: prNumber(url), url },
    })
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.needs === null, 'the need to be cleared')
    expect(t.pr).toMatchObject({ number: prNumber(url), url, checks: 'pending' })
    expect(t.pr?.pendingSince).toBeGreaterThanOrEqual(clock.t)
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    expect(sentFor(push, task.id)).toHaveLength(0)
  })

  it('then it is watched as in 128: the need returns once the checks passed', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [running('fast-feedback')] }))
    const task = await putTask(db, {
      stage: 'pr',
      needs: { kind: 'pr' },
      pr: { number: prNumber(url), url },
    })
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.needs === null && x.pr?.checks === 'pending', 'pending')
    github.answer(url, status({ checks: [ok('fast-feedback')] }))
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need back')
    expect(t.pr?.checks).toBe('passed')
  })

  it('a need written while the notifier runs is treated the same way', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [running('fast-feedback')] }))
    await startReady(db, github)
    const task = await putTask(db, {
      stage: 'build',
      needs: null,
      pr: { number: prNumber(url), url },
    })
    await patchTask(db, task.id, { stage: 'pr', needs: { kind: 'pr' } })
    const t = await waitForTask(
      db,
      task.id,
      (x) => x.needs === null && x.pr?.checks === 'pending',
      'the need to be cleared and watched'
    )
    expect(t.stage).toBe('pr')
  })

  it('a merge need on a PR whose checks failed is cleared too (a failed run is not a passed one)', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [running('fast-feedback')] }))
    const task = await putTask(db, {
      stage: 'pr',
      needs: { kind: 'pr' },
      pr: { number: prNumber(url), url, checks: 'failed', failed: ['build'] } as never,
    })
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.needs === null, 'the need to be cleared')
    expect(t.pr?.checks).toBe('pending')
  })

  it('a merge need on a PR whose checks passed is left alone and not read again', async () => {
    const url = prUrl()
    const task = await putTask(db, {
      stage: 'pr',
      needs: { kind: 'pr' },
      pr: { number: prNumber(url), url, checks: 'passed', head: 'abc123' } as never,
    })
    await startReady(db, github)
    await barrier(db, github)
    const t = await readTask(db, task.id)
    expect(t.needs).toEqual({ kind: 'pr' })
    expect(t.pr?.checks).toBe('passed')
    expect(github.count(url)).toBe(0)
  })
})

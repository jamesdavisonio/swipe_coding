// pr-ready 132 in the Firestore emulator (`npm run test:rules`): a PR with no checks at all counts
// as passed two minutes after it was set (when mergeable); a merged PR stops being watched and the
// need is set so James can confirm it; a closed PR gets pr.checks 'closed', no need, a comment
// "PR #<n> was closed", and is not read again.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adminDb,
  barrier,
  clearPrData,
  clock,
  done,
  fakeGithub,
  ok,
  polledTimes,
  running,
  prNumber,
  prTask,
  prUrl,
  PR_GRACE_MS,
  readComments,
  readTask,
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

describe('pr-ready 132: a PR with no checks', () => {
  it('is pending until two minutes after it was set, then passed', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += PR_GRACE_MS - 1
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += 1
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr?.checks).toBe('passed')
  })

  it('stays pending when GitHub has not said whether it can be merged', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [], mergeable: 'UNKNOWN' }))
    const task = await prTask(db, url, {}, { pendingSince: clock.t - 10 * PR_GRACE_MS })
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    github.answer(url, status({ checks: [], mergeable: 'MERGEABLE' }))
    await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
  })

  it('checks that appear later are waited for, not skipped by the grace period', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 1)
    github.answer(url, status({ checks: [{ name: 'build', status: 'PENDING', conclusion: '' }] }))
    clock.t += 10 * PR_GRACE_MS
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    github.answer(url, status({ checks: [ok('build')] }))
    await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
  })
})

describe('pr-ready 132: a merged or closed PR', () => {
  it('a merged PR counts as passed whatever its checks or mergeable say, and is not watched any more', async () => {
    const url = prUrl()
    github.answer(
      url,
      status({
        state: 'MERGED',
        mergeable: 'UNKNOWN',
        checks: [running('deploy'), done('build', 'FAILURE')],
      })
    )
    const task = await prTask(db, url)
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr?.checks).toBe('passed')
    await barrier(db, github)
    const seen = github.count(url)
    await barrier(db, github)
    expect(github.count(url)).toBe(seen)
  })

  it('a closed PR: checks closed, no need, one comment, not read again', async () => {
    const url = prUrl()
    github.answer(url, status({ state: 'CLOSED', checks: [ok('build')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.pr?.checks === 'closed', 'checks closed')
    expect(t.needs).toBeNull()
    await barrier(db, github)
    const seen = github.count(url)
    await barrier(db, github)
    expect(github.count(url)).toBe(seen)
    const closed = (await readComments(db, task.id)).filter((c) =>
      String(c.body).includes('was closed')
    )
    expect(closed).toHaveLength(1)
    expect(closed[0]).toMatchObject({ author: 'agent', body: `PR #${prNumber(url)} was closed` })
    expect((await readTask(db, task.id)).needs).toBeNull()
  })
})

// pr-ready 130 in the Firestore emulator (`npm run test:rules`): when any check has failed
// (failure, cancelled, timed out, action required; a merge conflict too) the notifier sets
// pr.checks 'failed' with the failed names (sorted), writes one comment "Checks failed on PR #<n>:
// <names>" in the thread, and the session's watcher prints it (kind ci_failed). No merge card.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  finished,
  seedSession,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'
import { clearDevices, seedDevices, sentFor } from '../fixtures/board-briefs-b7-emulator.ts'
import {
  adminDb,
  barrier,
  clearPrData,
  clock,
  done,
  fakeGithub,
  ok,
  polledTimes,
  prNumber,
  prTask,
  prUrl,
  push,
  readComments,
  readTask,
  running,
  startReady,
  status,
  stopAll,
  waitForTask,
  type Db,
} from '../fixtures/pr-ready-emulator.ts'

useBoardDb()
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

const failedComments = async (id: string) =>
  (await readComments(db, id)).filter((c) => String(c.body).startsWith('Checks failed'))

describe('pr-ready 130: a failed check', () => {
  it.each(['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])(
    'a %s check: failed, named once in the thread, no merge card',
    async (conclusion) => {
      const url = prUrl()
      github.answer(
        url,
        status({ head: 'f00d', checks: [ok('lint'), done('fast-feedback', conclusion)] })
      )
      const task = await prTask(db, url)
      await startReady(db, github)
      const t = await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
      expect(t.needs).toBeNull()
      expect(t.pr).toMatchObject({ failed: ['fast-feedback'], head: 'f00d' })
      await polledTimes(db, github, url, 3)
      expect((await readTask(db, task.id)).needs).toBeNull()
      const comments = await failedComments(task.id)
      expect(comments).toHaveLength(1)
      expect(comments[0]).toMatchObject({
        author: 'agent',
        kind: 'ci_failed',
        body: `Checks failed on PR #${prNumber(url)}: fast-feedback`,
      })
      expect(sentFor(push, task.id)).toHaveLength(0)
    }
  )

  it('several failures are named sorted, joined by ", "; passed and running checks are not named', async () => {
    const url = prUrl()
    github.answer(
      url,
      status({
        checks: [
          done('zeta', 'FAILURE'),
          ok('lint'),
          running('deploy-preview'),
          done('alpha', 'TIMED_OUT'),
        ],
      })
    )
    const task = await prTask(db, url)
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    expect(t.pr?.failed).toEqual(['alpha', 'zeta'])
    const comments = await failedComments(task.id)
    expect(comments.map((c) => c.body)).toEqual([
      `Checks failed on PR #${prNumber(url)}: alpha, zeta`,
    ])
  })

  it('a merge conflict is a failure named "merge conflict"', async () => {
    const url = prUrl()
    github.answer(url, status({ mergeable: 'CONFLICTING', checks: [ok('build')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    expect(t.pr?.failed).toEqual(['merge conflict'])
    expect(t.needs).toBeNull()
    expect((await failedComments(task.id))[0]?.body).toBe(
      `Checks failed on PR #${prNumber(url)}: merge conflict`
    )
  })

  it('the session’s watcher prints the failure as a ci_failed line and claims it', async () => {
    const session = await seedSession(db)
    const url = prUrl()
    github.answer(url, status({ checks: [done('fast-feedback', 'FAILURE'), ok('lint')] }))
    const task = await prTask(db, url, { agentId: session.agentId })
    const watcher = startWatcher(['--agent', session.agentId])
    await startReady(db, github)
    const run = await finished(watcher)
    expect(run.code).toBe(0)
    expect(run.lines).toEqual([
      JSON.stringify({
        task: task.id,
        kind: 'ci_failed',
        id: await commentId(task.id),
        from: 'board',
        text: `Checks failed on PR #${prNumber(url)}: fast-feedback`,
      }),
    ])
    // Claimed: marked delivered, so no other watcher prints it again.
    const stored = (await readComments(db, task.id)).find((c) => c.kind === 'ci_failed')
    expect(stored?.deliveredAt).not.toBeNull()
  })

  it('a task of no session still gets the thread comment and no merge card', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [done('build', 'FAILURE')] }))
    const task = await prTask(db, url, { agentId: null })
    await startReady(db, github)
    await waitForTask(db, task.id, (x) => x.pr?.checks === 'failed', 'checks failed')
    await barrier(db, github)
    expect(await failedComments(task.id)).toHaveLength(1)
    expect((await readTask(db, task.id)).needs).toBeNull()
  })
})

// The id of the task's ci_failed comment (the notifier's own write; the stored document id).
async function commentId(taskId: string): Promise<string> {
  const snap = await db.collection('comments').where('taskId', '==', taskId).get()
  const found = snap.docs.find((d) => d.get('kind') === 'ci_failed')
  if (!found) throw new Error('no ci_failed comment')
  return found.id
}

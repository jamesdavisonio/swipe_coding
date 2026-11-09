// pr-ready 128 in the Firestore emulator (`npm run test:rules`): the notifier watches every task
// whose pr.checks is pending. When every check has completed successfully (skipped and neutral
// count) and GitHub reports the PR mergeable, it sets pr.checks 'passed' (with the head commit) and
// the need { kind: 'pr' }, so the merge card appears. Until then it keeps watching and shows nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminDb,
  barrier,
  clearPrData,
  done,
  fakeGithub,
  ok,
  polledTimes,
  prNumber,
  prTask,
  prUrl,
  putTask,
  readComments,
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
})
afterAll(async () => {
  await stopAll()
  await clearPrData(db)
})

describe('pr-ready 128: pending until every check has passed', () => {
  it('all checks successful and mergeable: checks passed, head recorded, the merge need set', async () => {
    const url = prUrl()
    github.answer(url, status({ head: 'abc123', checks: [ok('build'), ok('lint')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr).toMatchObject({ url, checks: 'passed', head: 'abc123' })
    expect(t.stage).toBe('pr')
  })

  it('skipped and neutral count as passed', async () => {
    const url = prUrl()
    github.answer(
      url,
      status({ checks: [ok('build'), done('docs', 'SKIPPED'), done('lint', 'NEUTRAL')] })
    )
    const task = await prTask(db, url)
    await startReady(db, github)
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr?.checks).toBe('passed')
  })

  it('a check still running: no need, still pending; once it completes the need appears', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [ok('build'), running('fast-feedback')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    let t = await readTask(db, task.id)
    expect(t.needs).toBeNull()
    expect(t.pr?.checks).toBe('pending')
    github.answer(url, status({ checks: [ok('build'), ok('fast-feedback')] }))
    t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr?.checks).toBe('passed')
  })

  it('mergeable UNKNOWN keeps it pending even when every check passed', async () => {
    const url = prUrl()
    github.answer(url, status({ mergeable: 'UNKNOWN' }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    const t = await readTask(db, task.id)
    expect(t.needs).toBeNull()
    expect(t.pr?.checks).toBe('pending')
    github.answer(url, status({ mergeable: 'MERGEABLE' }))
    await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
  })

  it('does not watch a PR that was only recorded (no pending checks)', async () => {
    const url = prUrl()
    const early = await putTask(db, { stage: 'build', pr: { number: prNumber(url), url } })
    await startReady(db, github)
    await barrier(db, github)
    expect(github.count(url)).toBe(0)
    expect((await readTask(db, early.id)).needs).toBeNull()
  })

  it('does not read the PR of a chore that only recorded it', async () => {
    const url = prUrl()
    await putTask(db, { type: 'chore', stage: 'do', pr: { number: prNumber(url), url } })
    await startReady(db, github)
    await barrier(db, github)
    expect(github.count(url)).toBe(0)
  })

  it('a notifier that lost its lease reads no more PRs and writes nothing to tasks', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '))
    })
    const second = fakeGithub()
    try {
      await startReady(db, github, { heartbeatMs: 200 })
      await db
        .collection('notifier')
        .doc('lease')
        .set({ pid: 1, hostname: 'elsewhere', startedAt: 1, lastSeen: 1 })
      await waitFor(
        () =>
          Promise.resolve(
            lines.some((l) =>
              l.includes('notifier lost its lease to another notifier: no longer sending')
            )
          ),
        'the first notifier to log that it lost its lease'
      )
    } finally {
      spy.mockRestore()
    }
    // A PR set while only the first (lost) notifier exists: it must not read it or settle it.
    const url = prUrl()
    github.answer(url, status())
    second.answer(url, status({ head: 'second' }))
    const task = await prTask(db, url)
    await startReady(db, second)
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr?.head).toBe('second')
    expect(github.count(url)).toBe(0)
  })

  it('says "Checks running on PR #<n>" once when it starts watching', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [running('fast-feedback')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 3)
    const running_ = (await readComments(db, task.id)).filter((c) =>
      String(c.body).startsWith('Checks running')
    )
    expect(running_).toHaveLength(1)
    expect(running_[0]).toMatchObject({
      author: 'agent',
      kind: 'comment',
      body: `Checks running on PR #${prNumber(url)}`,
    })
  })
})

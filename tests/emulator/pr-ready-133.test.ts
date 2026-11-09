// pr-ready 133 in the Firestore emulator (`npm run test:rules`): when reading the checks fails
// (GitHub unreachable, the CLI missing or signed out) the notifier keeps the task pending, stores
// one api_call_failed WARNING (target github, task_id, status = the error's code) per task per
// hour at most, and keeps trying; after 30 minutes of failed reads it shows the merge card anyway,
// with a thread note that the checks could not be read.
import type { DocumentData } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import {
  adminDb,
  clearPrData,
  clock,
  fakeGithub,
  MINUTE,
  barrier,
  ok,
  polledTimes,
  prNumber,
  prTask,
  prUrl,
  readComments,
  readError,
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

const warningFor = (id: string) => (e: DocumentData) =>
  e.event_type === 'api_call_failed' && e.context?.task_id === id

describe('pr-ready 133: the checks cannot be read', () => {
  it('stays pending, shows no card, and stores one WARNING however often it retries', async () => {
    const url = prUrl()
    github.answer(url, readError('ENOENT'))
    const task = await prTask(db, url)
    await startReady(db, github)
    const warning = await waitForLog(warningFor(task.id), 'the github warning')
    expect(warning).toMatchObject({
      severity: 'WARNING',
      event_type: 'api_call_failed',
      source: 'server',
      context: { target: 'github', task_id: task.id, status: 'ENOENT' },
    })
    await polledTimes(db, github, url, 5)
    expect(await agentLogs(warningFor(task.id))).toHaveLength(1)
    const t = await readTask(db, task.id)
    expect(t.needs).toBeNull()
    expect(t.pr?.checks).toBe('pending')
  })

  it('an exit code is the status; each task has its own warning', async () => {
    const a = prUrl()
    const b = prUrl()
    github.answer(a, readError('exit_1'))
    github.answer(b, readError('ENOENT'))
    const ta = await prTask(db, a)
    const tb = await prTask(db, b)
    await startReady(db, github)
    const wa = await waitForLog(warningFor(ta.id), 'the first warning')
    const wb = await waitForLog(warningFor(tb.id), 'the second warning')
    expect(wa.context?.status).toBe('exit_1')
    expect(wb.context?.status).toBe('ENOENT')
  })

  it('warns again once an hour has passed, not before', async () => {
    const url = prUrl()
    github.answer(url, readError('exit_1'))
    const task = await prTask(db, url)
    await startReady(db, github, { githubGiveUpMs: 100 * 60 * MINUTE })
    await waitForLog(warningFor(task.id), 'the first warning')
    clock.t += 59 * MINUTE
    await polledTimes(db, github, url, 3)
    expect(await agentLogs(warningFor(task.id))).toHaveLength(1)
    clock.t += 2 * MINUTE
    await waitFor(
      async () => (await agentLogs(warningFor(task.id))).length >= 2,
      'a second warning after the hour'
    )
    expect(await agentLogs(warningFor(task.id))).toHaveLength(2)
  })

  it('before 30 minutes it keeps trying and shows nothing; at 30 minutes the merge card appears with a note', async () => {
    const url = prUrl()
    github.answer(url, readError('exit_4'))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    clock.t += 30 * MINUTE - 1
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += 1
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need anyway')
    expect(t.stage).toBe('pr')
    await barrier(db, github)
    const seen = github.count(url)
    await barrier(db, github)
    expect(github.count(url)).toBe(seen) // no longer read
    expect((await readTask(db, task.id)).needs).toEqual({ kind: 'pr' })
    expect((await readTask(db, task.id)).pr?.checks).toBe('unread')
    const notes = (await readComments(db, task.id)).filter((c) =>
      String(c.body).startsWith("Couldn't read the checks")
    )
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      author: 'agent',
      body: `Couldn't read the checks of PR #${prNumber(url)}; showing the merge card anyway`,
    })
  })

  it('reads that work but show running checks never give up', async () => {
    const url = prUrl()
    github.answer(url, status({ checks: [running('build')] }))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    clock.t += 40 * MINUTE
    await polledTimes(db, github, url, 2)
    const t = await readTask(db, task.id)
    expect(t.needs).toBeNull()
    expect(t.pr?.checks).toBe('pending')
    expect(
      (await readComments(db, task.id)).filter((c) => String(c.body).startsWith("Couldn't read"))
    ).toHaveLength(0)
  })

  it('a successful read restarts the 30 minutes: only 30 consecutive minutes of failed reads give up', async () => {
    const url = prUrl()
    github.answer(url, readError('exit_1'))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    clock.t += 20 * MINUTE
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    github.answer(url, status({ checks: [running('build')] })) // a read that works, at +20
    await polledTimes(db, github, url, 2)
    clock.t += 20 * MINUTE // +40 from the start, but only 0 failed minutes since the success
    github.answer(url, readError('exit_1'))
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += 30 * MINUTE - 1
    await polledTimes(db, github, url, 2)
    expect((await readTask(db, task.id)).needs).toBeNull()
    clock.t += 1
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr?.checks).toBe('unread')
  })

  it('a read that works again carries on as in 128, with no merge card shown anyway', async () => {
    const url = prUrl()
    github.answer(url, readError('exit_1'))
    const task = await prTask(db, url)
    await startReady(db, github)
    await polledTimes(db, github, url, 2)
    github.answer(url, status({ checks: [ok('build')], head: 'h9' }))
    const t = await waitForTask(db, task.id, (x) => x.needs?.kind === 'pr', 'the merge need')
    expect(t.pr).toMatchObject({ checks: 'passed', head: 'h9' })
    expect(
      (await readComments(db, task.id)).filter((c) => String(c.body).startsWith("Couldn't read"))
    ).toHaveLength(0)
  })
})

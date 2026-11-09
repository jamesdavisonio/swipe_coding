// launch-session 123 in the Firestore emulator (`npm run test:rules`): a request is started at
// most once. The notifier claims it (requested -> starting) before it starts anything, then
// writes started with startedAt and the session id. A claim left in `starting` by a notifier that
// stopped mid-start becomes failed with "interrupted" when the next notifier starts, and is never
// started a second time.
import type { DocumentData } from 'firebase-admin/firestore'
import { agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adminDb,
  barrier,
  callsFor,
  clearLaunchData,
  fakeLaunch,
  launchState,
  push,
  putLaunchTask,
  putProject,
  readComments,
  requested,
  startWith,
  stopAll,
  waitFor,
  waitForState,
  type Db,
} from '../fixtures/launch-session-emulator.ts'

const warningFor = (id: string) => (e: DocumentData) =>
  e.event_type === 'api_call_failed' && e.context?.task_id === id

let db: Db
const launch = fakeLaunch()

beforeAll(async () => {
  db = await adminDb()
})
beforeEach(async () => {
  await stopAll()
  await clearLaunchData(db)
  launch.reset()
  push.reset()
})
afterAll(async () => {
  await stopAll()
  await clearLaunchData(db)
})

describe('launch-session 123: at most once', () => {
  it('the task is `starting` when the session is started, then `started` with the session id', async () => {
    const seen: string[] = []
    launch.behave = async () => {
      // What the board holds at the moment the session is being started.
      const tasks = await db.collection('tasks').where('launch.state', '==', 'starting').get()
      seen.push(...tasks.docs.map((d) => d.id))
      return { sessionId: 'bg-session-42' }
    }
    const t = await putLaunchTask(db, await putProject(db), {
      state: 'requested',
      requestedAt: 1_700_000_000_123,
    })
    const before = Date.now()
    await startWith(db, launch)
    const done = await waitForState(db, t.id, 'started')
    expect(done?.requestedAt).toBe(1_700_000_000_123)
    expect(seen).toContain(t.id)
    expect(done?.sessionId).toBe('bg-session-42')
    expect(done?.startedAt).toBeGreaterThanOrEqual(before)
    expect(done?.startedAt).toBeLessThanOrEqual(Date.now())
  })

  it('editing the task while its start is pending does not start a second session', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    launch.behave = async () => {
      await gate
      return { sessionId: 'slow' }
    }
    const t = await putLaunchTask(db, await putProject(db), requested())
    await startWith(db, launch)
    await waitFor(async () => (await launchState(db, t.id)) === 'starting', 'the claim')
    await db.collection('tasks').doc(t.id).update({ updatedAt: Date.now(), stage: 'build' })
    await db.collection('tasks').doc(t.id).update({ working: true, updatedAt: Date.now() })
    release()
    await waitForState(db, t.id, 'started')
    await barrier(db)
    expect(callsFor(launch, t.id)).toHaveLength(1)
  })

  it('a restarted notifier does not start a request it already started', async () => {
    const t = await putLaunchTask(db, await putProject(db), requested())
    await startWith(db, launch)
    await waitForState(db, t.id, 'started')
    await stopAll()
    await startWith(db, launch)
    await barrier(db)
    expect(callsFor(launch, t.id)).toHaveLength(1)
    expect(await launchState(db, t.id)).toBe('started')
  })

  it('a claim left in `starting` is a failure like any other: reason, comment and warning, once', async () => {
    const p = await putProject(db)
    const t = await putLaunchTask(db, p, { state: 'starting', requestedAt: 1_700_000_000_123 })
    const before = Date.now()
    await startWith(db, launch)
    const failed = await waitForState(db, t.id, 'failed')
    expect(failed?.reason).toBe('interrupted')
    expect(failed?.requestedAt).toBe(1_700_000_000_123)
    expect(failed?.failedAt).toBeGreaterThanOrEqual(before)
    const warning = await waitForLog(warningFor(t.id), 'the interrupted warning')
    expect(warning).toMatchObject({
      severity: 'WARNING',
      event_type: 'api_call_failed',
      context: { target: 'claude', task_id: t.id, status: 'interrupted' },
    })
    await barrier(db)
    expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(await launchState(db, t.id)).toBe('failed')
    const comments = await readComments(db, t.id)
    expect(comments).toHaveLength(1)
    expect(comments[0]).toMatchObject({
      taskId: t.id,
      projectId: p,
      author: 'agent',
      kind: 'comment',
      body: "Couldn't start a session: interrupted",
    })
    expect(await agentLogs(warningFor(t.id))).toHaveLength(1)
  })

  it('an interrupted claim stays failed across further restarts: never started, reported once', async () => {
    const t = await putLaunchTask(db, await putProject(db), {
      state: 'starting',
      requestedAt: Date.now(),
    })
    await startWith(db, launch)
    await waitForState(db, t.id, 'failed')
    await waitForLog(warningFor(t.id), 'the interrupted warning')
    await stopAll()
    await startWith(db, launch)
    await barrier(db)
    expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(await launchState(db, t.id)).toBe('failed')
    expect(await readComments(db, t.id)).toHaveLength(1)
    expect(await agentLogs(warningFor(t.id))).toHaveLength(1)
  })
})

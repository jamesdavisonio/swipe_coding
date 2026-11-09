// launch-session 124 in the Firestore emulator (`npm run test:rules`): when starting fails (the
// folder is missing, or Claude Code is not found or exits with an error) the task gets
// launch { state: 'failed', failedAt, reason }, one agent comment "Couldn't start a session:
// <reason>" in its thread and one api_call_failed WARNING (target claude, task_id, status) in the
// stored logs; the notifier keeps running.
import type { DocumentData } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import {
  adminDb,
  callsFor,
  clearLaunchData,
  fakeLaunch,
  folder,
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

const warningFor = (id: string) => (e: DocumentData) =>
  e.event_type === 'api_call_failed' && e.context?.task_id === id

// Fails one more request: its warning is stored after the earlier ones, so once it is readable
// every event the earlier requests caused is stored too.
async function failedBarrier(): Promise<void> {
  const p = await putProject(db, { cwd: folder('missing') })
  const t = await putLaunchTask(db, p, requested())
  await waitForLog(warningFor(t.id), 'the barrier warning')
}

const REQUESTED_AT = 1_700_000_000_123
const requestedAtFixed = () => ({ state: 'requested', requestedAt: REQUESTED_AT })

async function expectFailure(
  taskId: string,
  projectId: string,
  reason: string,
  status: string,
  before: number
) {
  const failed = await waitForState(db, taskId, 'failed')
  expect(failed?.reason).toBe(reason)
  expect(failed?.requestedAt).toBe(REQUESTED_AT)
  expect(failed?.failedAt).toBeGreaterThanOrEqual(before)
  const comments = await waitFor(async () => {
    const list = await readComments(db, taskId)
    return list.length > 0 && list
  }, 'the failure comment')
  expect(comments).toHaveLength(1)
  expect(comments[0]).toMatchObject({
    taskId,
    projectId,
    author: 'agent',
    kind: 'comment',
    body: `Couldn't start a session: ${reason}`,
  })
  const warning = await waitForLog(warningFor(taskId), 'the api_call_failed warning')
  expect(warning).toMatchObject({
    severity: 'WARNING',
    event_type: 'api_call_failed',
    source: 'server',
    context: { target: 'claude', task_id: taskId },
  })
  expect(warning.context?.status).toBe(status)
}

describe('launch-session 124: starting fails', () => {
  it('a port that rejects: failed with the error message, one comment, one warning', async () => {
    launch.behave = () =>
      Promise.reject(Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }))
    const p = await putProject(db)
    const t = await putLaunchTask(db, p, requestedAtFixed())
    const before = Date.now()
    await startWith(db, launch)
    await expectFailure(t.id, p, 'spawn claude ENOENT', 'ENOENT', before)
    await failedBarrier()
    expect(await readComments(db, t.id)).toHaveLength(1)
    expect(await agentLogs(warningFor(t.id))).toHaveLength(1)
  })

  it('a missing folder: failed with "folder not found: <cwd>" and the port is not called', async () => {
    const cwd = folder('missing')
    const p = await putProject(db, { cwd })
    const t = await putLaunchTask(db, p, requestedAtFixed())
    const before = Date.now()
    await startWith(db, launch)
    await expectFailure(t.id, p, `folder not found: ${cwd}`, 'folder_not_found', before)
    await failedBarrier()
    expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(await readComments(db, t.id)).toHaveLength(1)
    expect(await agentLogs(warningFor(t.id))).toHaveLength(1)
  })

  it('an error with an exit code keeps it as the status; one without a code is "unknown"', async () => {
    const p = await putProject(db)
    launch.behave = () =>
      Promise.reject(Object.assign(new Error('Not logged in'), { code: 'exit_2' }))
    const exited = await putLaunchTask(db, p, requestedAtFixed())
    await startWith(db, launch)
    await expectFailure(exited.id, p, 'Not logged in', 'exit_2', 0)
    launch.behave = () => Promise.reject(new Error('something odd'))
    const plain = await putLaunchTask(db, p, requestedAtFixed())
    await expectFailure(plain.id, p, 'something odd', 'unknown', 0)
  })

  it('the notifier keeps running: the next request is started', async () => {
    launch.behave = () => Promise.reject(new Error('claude exited with code 1'))
    const bad = await putLaunchTask(db, await putProject(db), requested())
    await startWith(db, launch)
    await waitForState(db, bad.id, 'failed')
    launch.behave = () => Promise.resolve({ sessionId: 'after-failure' })
    const good = await putLaunchTask(db, await putProject(db), requested())
    const done = await waitForState(db, good.id, 'started')
    expect(done?.sessionId).toBe('after-failure')
    expect(await readComments(db, good.id)).toHaveLength(0)
  })

  it('a started session writes no failure comment and no warning', async () => {
    const t = await putLaunchTask(db, await putProject(db), requested())
    await startWith(db, launch)
    await waitForState(db, t.id, 'started')
    await failedBarrier()
    expect(await readComments(db, t.id)).toHaveLength(0)
    expect(await agentLogs(warningFor(t.id))).toHaveLength(0)
  })
})

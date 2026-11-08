// decision-notifications 82 in the Firestore emulator (`npm run test:rules`): when sending fails
// (the push port throws, or reports a failed token) the session's tool call still succeeds with
// its usual result, and one WARNING api_call_failed event (target fcm, status, task_id,
// device_count, removed) is stored for kanban_logs to show.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentData } from 'firebase-admin/firestore'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import { agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import {
  fakePush,
  logBarrier,
  readTask,
  seedDevices,
  taskAt,
  useBoard,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-82', push)
beforeEach(async () => {
  push.reset()
  await seedDevices(board(), ['tok-a', 'tok-b'])
})

const forTask = (id: string) => (e: DocumentData) =>
  e.event_type === 'api_call_failed' && e.context?.task_id === id
const fail = (code?: string) => () =>
  Promise.reject(Object.assign(new Error('push service down'), code ? { code } : {}))

describe('decision-notifications 82: sending fails', () => {
  it('a push port that throws leaves the question call successful and logs one warning', async () => {
    push.behave = fail('messaging/internal-error')
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    const c = await board().ask(t.id, 'Which branch?')
    expect(c).toMatchObject({ taskId: t.id, kind: 'question', body: 'Which branch?' })
    expect((await readTask(board(), t.id)).needs).toEqual({
      kind: 'question',
      question: 'Which branch?',
    })
    const e = await waitForLog(forTask(t.id), 'warning for the failed send')
    expect(e).toMatchObject({
      severity: 'WARNING',
      event_type: 'api_call_failed',
      source: 'server',
      context: {
        target: 'fcm',
        status: 'messaging/internal-error',
        task_id: t.id,
        device_count: 2,
        removed: 0,
      },
    })
    await logBarrier(board(), push)
    expect(await agentLogs(forTask(t.id))).toHaveLength(1)
  })

  it('a throw without an error code is logged with status "unknown"', async () => {
    push.behave = fail()
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    const result = await board().setSubtask(t.id, 'spec', 'awaiting_approval', briefText('spec'))
    expect(result.needs).toEqual({ kind: 'spec' })
    const e = await waitForLog(forTask(t.id), 'warning for the failed spec send')
    expect(e.severity).toBe('WARNING')
    expect(e.context).toMatchObject({ target: 'fcm', status: 'unknown', device_count: 2 })
  })

  it('a failed outcome is logged with the first failed code and the call succeeds', async () => {
    push.behave = (_n, tokens) =>
      Promise.resolve([
        { token: tokens[0], ok: true },
        { token: tokens[1], ok: false, code: 'messaging/server-unavailable', unregistered: false },
      ])
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await expect(board().ask(t.id, 'Still there?')).resolves.toMatchObject({ taskId: t.id })
    const e = await waitForLog(forTask(t.id), 'warning for the failed token')
    expect(e.severity).toBe('WARNING')
    expect(e.context).toMatchObject({
      target: 'fcm',
      status: 'messaging/server-unavailable',
      device_count: 2,
      removed: 0,
    })
  })

  it('stores nothing when every outcome is ok', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'All good?')
    await logBarrier(board(), push)
    expect(await agentLogs(forTask(t.id))).toHaveLength(0)
  })
})

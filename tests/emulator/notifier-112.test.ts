// notifier 112 in the Firestore emulator (`npm run test:rules`): sending failures and dead tokens
// are handled as in decision-notifications 82-83: one api_call_failed WARNING (target fcm, status,
// task_id, device_count, removed) per failed send, stored for kanban_logs; tokens the push service
// reports unregistered are deleted. No failure stops the notifier.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentData } from 'firebase-admin/firestore'
import type { PushOutcome } from '../../packages/agent/src/push.ts'
import { agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import {
  deviceTokens,
  fakePush,
  logBarrier,
  putTask,
  seedDevices,
  sentFor,
  settle,
  useNotifier,
  waitFor,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const db = useNotifier(push)
beforeEach(async () => {
  push.reset()
  await seedDevices(db(), ['tok-a', 'tok-b'])
})

const ask = (question: string) => putTask(db(), { needs: { kind: 'question', question } })
const forTask = (id: string) => (e: DocumentData) =>
  e.event_type === 'api_call_failed' && e.context?.task_id === id
const fail = (code?: string) => () =>
  Promise.reject(Object.assign(new Error('push service down'), code ? { code } : {}))
const refuse =
  (code: string, unregistered: boolean, only?: string[]) => (_n: unknown, tokens: string[]) =>
    Promise.resolve(
      tokens.map((token): PushOutcome =>
        only && !only.includes(token)
          ? { token, ok: true }
          : { token, ok: false, code, unregistered }
      )
    )
const GONE = 'messaging/registration-token-not-registered'
const devicesAre = (expected: string[]) => () =>
  deviceTokens(db()).then((t) => JSON.stringify(t) === JSON.stringify(expected))

describe('notifier 112: sending fails', () => {
  it('a push port that throws is logged as one WARNING api_call_failed with its context', async () => {
    push.behave = fail('messaging/internal-error')
    const t = await ask('Which branch?')
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
    await logBarrier(db(), push)
    expect(await agentLogs(forTask(t.id))).toHaveLength(1)
  })

  it('a throw without an error code is logged with status "unknown"', async () => {
    push.behave = fail()
    const t = await putTask(db(), { stage: 'spec', needs: { kind: 'spec' } })
    const e = await waitForLog(forTask(t.id), 'warning for the failed spec send')
    expect(e.severity).toBe('WARNING')
    expect(e.context).toMatchObject({ target: 'fcm', status: 'unknown', device_count: 2 })
  })

  it('a failed outcome is logged with the first failed code and removes nothing', async () => {
    push.behave = refuse('messaging/server-unavailable', false, ['tok-b'])
    const t = await ask('Still there?')
    const e = await waitForLog(forTask(t.id), 'warning for the failed token')
    expect(e.severity).toBe('WARNING')
    expect(e.context).toMatchObject({
      target: 'fcm',
      status: 'messaging/server-unavailable',
      device_count: 2,
      removed: 0,
    })
    expect(await deviceTokens(db())).toEqual(['tok-a', 'tok-b'])
  })

  it('stores nothing when every outcome is ok', async () => {
    const t = await ask('All good?')
    await waitForSends(push, t.id)
    await logBarrier(db(), push)
    expect(await agentLogs(forTask(t.id))).toHaveLength(0)
  })

  it('one warning per failed send, and the notifier keeps sending afterwards', async () => {
    push.behave = fail('messaging/internal-error')
    const a = await ask('First failure?')
    const b = await ask('Second failure?')
    await waitForLog(forTask(a.id), 'first warning')
    await waitForLog(forTask(b.id), 'second warning')
    push.reset()
    const c = await ask('Does it still work?')
    const [call] = await waitForSends(push, c.id)
    expect(call.notice.body).toBe('Does it still work?')
    await logBarrier(db(), push)
    expect(await agentLogs(forTask(a.id))).toHaveLength(1)
    expect(await agentLogs(forTask(b.id))).toHaveLength(1)
    expect(await agentLogs(forTask(c.id))).toHaveLength(0)
  })

  it('task documents of an unknown shape are skipped and do not stop the notifier', async () => {
    const odd = [
      db().collection('tasks').doc(),
      db().collection('tasks').doc(),
      db().collection('tasks').doc(),
    ]
    await odd[0].set({ needs: 7 })
    await odd[1].set({})
    await odd[2].set({ needs: { kind: 'question', question: 42 }, projectId: 'nowhere' })
    await settle(db(), push)
    for (const ref of odd) expect(sentFor(push, ref.id)).toHaveLength(0)
  })
})

describe('notifier 112: a dead token is dropped', () => {
  it('removes the unregistered device and keeps the others', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = refuse(GONE, true, ['tok-dead'])
    await ask('Anyone there?')
    await waitFor(devicesAre(['tok-live']), 'the dead device to be removed')
  })

  it('removes every record that holds the token, for either unregistered code', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead', 'tok-dead', 'tok-invalid'])
    push.behave = (_n, tokens) =>
      Promise.resolve(
        tokens.map((token): PushOutcome => {
          if (token === 'tok-dead') return { token, ok: false, code: GONE, unregistered: true }
          if (token === 'tok-invalid')
            return {
              token,
              ok: false,
              code: 'messaging/invalid-registration-token',
              unregistered: true,
            }
          return { token, ok: true }
        })
      )
    await ask('Clean up?')
    await waitFor(devicesAre(['tok-live']), 'every dead record to be removed')
  })

  it('does not send to the removed device for the next decision', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = refuse(GONE, true, ['tok-dead'])
    const t = await ask('First?')
    await waitFor(devicesAre(['tok-live']), 'the dead device to be removed')
    const next = await ask('Second?')
    const [call] = await waitForSends(push, next.id)
    expect(call.tokens).toEqual(['tok-live'])
    expect(sentFor(push, t.id)).toHaveLength(1)
  })

  it('reports the removal in the warning (removed: 1)', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = refuse(GONE, true, ['tok-dead'])
    const t = await ask('Logged?')
    const e = await waitForLog(forTask(t.id), 'warning naming the removal')
    expect(e.severity).toBe('WARNING')
    expect(e.context).toMatchObject({
      target: 'fcm',
      status: GONE,
      task_id: t.id,
      device_count: 2,
      removed: 1,
    })
    await logBarrier(db(), push)
    expect(await agentLogs(forTask(t.id))).toHaveLength(1)
  })
})

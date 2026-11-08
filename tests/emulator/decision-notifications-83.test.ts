// decision-notifications 83 in the Firestore emulator (`npm run test:rules`): when the push
// service reports a token is no longer registered, the notifier removes that token's device
// records, so later decisions are not sent to it; the other devices stay.
import { beforeEach, describe, expect, it } from 'vitest'
import type { PushOutcome } from '../../packages/agent/src/push.ts'
import { agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import {
  deviceTokens,
  fakePush,
  logBarrier,
  seedDevices,
  taskAt,
  useBoard,
  useNotifier,
  waitFor,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-83')
const db = useNotifier(push)
beforeEach(() => push.reset())

const gone = (
  token: string,
  code = 'messaging/registration-token-not-registered'
): PushOutcome => ({
  token,
  ok: false,
  code,
  unregistered: true,
})
const answer = (dead: Record<string, string | undefined>) => (_n: unknown, tokens: string[]) =>
  Promise.resolve(
    tokens.map((t): PushOutcome => (t in dead ? gone(t, dead[t]) : { token: t, ok: true }))
  )
const devicesAre = (expected: string[]) => () =>
  deviceTokens(db()).then((tokens) => JSON.stringify(tokens) === JSON.stringify(expected))

describe('decision-notifications 83: a dead token is dropped', () => {
  it('removes the unregistered device and keeps the others', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = answer({ 'tok-dead': undefined })
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Anyone there?')
    await waitFor(devicesAre(['tok-live']), 'the dead device to be removed')
    expect(await deviceTokens(db())).toEqual(['tok-live'])
  })

  it('does not send to the removed device for the next decision', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = answer({ 'tok-dead': undefined })
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'First?')
    await waitFor(devicesAre(['tok-live']), 'the dead device to be removed')
    await board().ask(t.id, 'Second?')
    const calls = await waitForSends(push, t.id, 2)
    expect(calls).toHaveLength(2)
    expect(calls[1].tokens).toEqual(['tok-live'])
  })

  it('removes every record that holds the token, for either unregistered code', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead', 'tok-dead', 'tok-invalid'])
    push.behave = answer({
      'tok-dead': undefined,
      'tok-invalid': 'messaging/invalid-registration-token',
    })
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Clean up?')
    await waitFor(devicesAre(['tok-live']), 'every dead record to be removed')
    expect(await deviceTokens(db())).toEqual(['tok-live'])
  })

  it('removes nothing for a failure that is not an unregistered token', async () => {
    await seedDevices(db(), ['tok-a', 'tok-b'])
    push.behave = (_n, tokens) =>
      Promise.resolve(
        tokens.map((token): PushOutcome => ({
          token,
          ok: false,
          code: 'messaging/server-unavailable',
          unregistered: false,
        }))
      )
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Retry later?')
    await waitForLog(
      (x) => x.event_type === 'api_call_failed' && x.context?.task_id === t.id,
      'the failure warning'
    )
    expect(await deviceTokens(db())).toEqual(['tok-a', 'tok-b'])
  })

  it('also removes the dead token when the decision is a spec', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = answer({ 'tok-dead': undefined })
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(t.id, 'spec', 'awaiting_approval')
    await waitFor(devicesAre(['tok-live']), 'the dead device to be removed')
    expect(await deviceTokens(db())).toEqual(['tok-live'])
  })

  it('reports the removal in the warning (removed: 1) while the call succeeds', async () => {
    await seedDevices(db(), ['tok-live', 'tok-dead'])
    push.behave = answer({ 'tok-dead': undefined })
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Logged?')
    const e = await waitForLog(
      (x) => x.event_type === 'api_call_failed' && x.context?.task_id === t.id,
      'warning naming the removal'
    )
    expect(e.severity).toBe('WARNING')
    expect(e.context).toMatchObject({
      target: 'fcm',
      status: 'messaging/registration-token-not-registered',
      device_count: 2,
      removed: 1,
    })
    await logBarrier(db(), push)
    expect(await agentLogs((x) => x.context?.task_id === t.id)).toHaveLength(1)
  })
})

// decision-notifications 80 in the Firestore emulator (`npm run test:rules`): a revised spec or a
// new question on the same task is sent by the notifier under the same tag ("decision:<task id>"),
// so the phone replaces the old notification; another task has its own tag.
import { beforeEach, describe, expect, it } from 'vitest'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  fakePush,
  seedDevices,
  sentFor,
  settle,
  taskAt,
  useBoard,
  useNotifier,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-80')
const db = useNotifier(push)
beforeEach(async () => {
  push.reset()
  await seedDevices(db(), ['tok-a'])
})

describe('decision-notifications 80: one notification per task', () => {
  it('sends a revised spec under the same tag as the first', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'First draft' })
    )
    await waitForSends(push, t.id, 1)
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'Second draft' })
    )
    await waitForSends(push, t.id, 2)
    await settle(db(), push)
    const calls = sentFor(push, t.id)
    expect(calls.map((c) => [c.notice.tag, c.notice.body])).toEqual([
      [`decision:${t.id}`, 'First draft'],
      [`decision:${t.id}`, 'Second draft'],
    ])
  })

  it('sends a new question under the same tag as the spec before it', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'A spec' })
    )
    await waitForSends(push, t.id, 1)
    await board().ask(t.id, 'Which branch?')
    await waitForSends(push, t.id, 2)
    await settle(db(), push)
    const calls = sentFor(push, t.id)
    expect(calls.map((c) => [c.notice.tag, c.notice.title.split(' · ')[0]])).toEqual([
      [`decision:${t.id}`, 'Spec'],
      [`decision:${t.id}`, 'Question'],
    ])
  })

  it('gives another task its own tag', async () => {
    const a = await taskAt(board(), 'feature', { stage: 'spec' })
    const b = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(a.id, 'spec', 'awaiting_approval')
    await board().setSubtask(b.id, 'spec', 'awaiting_approval')
    await waitForSends(push, a.id)
    await waitForSends(push, b.id)
    await settle(db(), push)
    expect(sentFor(push, a.id).map((c) => c.notice.tag)).toEqual([`decision:${a.id}`])
    expect(sentFor(push, b.id).map((c) => c.notice.tag)).toEqual([`decision:${b.id}`])
  })
})

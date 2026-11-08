// decision-notifications 77 in the Firestore emulator (`npm run test:rules`): a spec posted for
// approval (setSubtask spec -> awaiting_approval, written by a session's Board) is sent by the
// notifier (docs/features/notifier.md; the session no longer sends) to each registered device as
// one notification, titled "Spec · <project name>", with the deck's headline for the spec card.
import { beforeEach, describe, expect, it } from 'vitest'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  deviceTokens,
  fakePush,
  projectName,
  readTask,
  seedDevices,
  sentFor,
  settle,
  taskAt,
  useBoard,
  useNotifier,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-77')
const db = useNotifier(push)
beforeEach(() => push.reset())

const newSpecTask = (title: string) => board().createTask({ title, type: 'feature' })

describe('decision-notifications 77: posting a spec', () => {
  it('sends every device one notification titled "Spec · <project>" with the Yes: line', async () => {
    await seedDevices(db(), ['tok-a', 'tok-b'])
    const t = await newSpecTask('Notify me')
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'Start building notifications for decision cards' })
    )
    await waitForSends(push, t.id)
    await settle(db(), push)
    const calls = sentFor(push, t.id)
    const name = await projectName(board())
    expect(calls).toHaveLength(1)
    expect(calls[0].notice).toMatchObject({
      kind: 'spec',
      title: `Spec · ${name}`,
      body: 'Start building notifications for decision cards',
      tag: `decision:${t.id}`,
      url: `/?task=${t.id}`,
    })
    expect([...calls[0].tokens].sort()).toEqual(['tok-a', 'tok-b'])
    // The session's call still did its usual work.
    expect((await readTask(board(), t.id)).needs).toEqual({ kind: 'spec' })
  })

  it('falls back to "Start building: <task title>" when the note is not a spec brief', async () => {
    await seedDevices(db(), ['tok-a'])
    const t = await newSpecTask('Order the replies')
    await board().setSubtask(t.id, 'spec', 'awaiting_approval')
    const [first] = await waitForSends(push, t.id)
    expect(first.notice.body).toBe('Start building: Order the replies')
    const u = await newSpecTask('Another one')
    await board().setSubtask(
      u.id,
      'spec',
      'awaiting_approval',
      briefText('fix', { yes: 'Mend it' })
    )
    const [second] = await waitForSends(push, u.id)
    expect(second.notice.body).toBe('Start building: Another one')
  })

  it('cuts a long Yes: line to 60 characters the way the card does', async () => {
    await seedDevices(db(), ['tok-a'])
    const t = await newSpecTask('Long one')
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'q'.repeat(80) })
    )
    await waitForSends(push, t.id)
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(1)
    const [call] = sentFor(push, t.id)
    expect(call.notice.body).toBe(`${'q'.repeat(59)}…`)
  })

  it('sends nothing for the spec step in any other status', async () => {
    await seedDevices(db(), ['tok-a'])
    const t = await newSpecTask('Quiet steps')
    await board().setSubtask(t.id, 'spec', 'in_progress')
    await board().setSubtask(t.id, 'spec', 'done')
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
    expect(await deviceTokens(db())).toEqual(['tok-a'])
  })

  it('uses only the devices that hold a valid token', async () => {
    await seedDevices(db(), ['tok-a'])
    await db().collection('devices').doc('bad-empty').set({ token: '', createdAt: 1, updatedAt: 1 })
    await db().collection('devices').doc('bad-type').set({ token: 7, createdAt: 1, updatedAt: 1 })
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(t.id, 'spec', 'awaiting_approval')
    await waitForSends(push, t.id)
    await settle(db(), push)
    const calls = sentFor(push, t.id)
    expect(calls).toHaveLength(1)
    expect(calls[0].tokens).toEqual(['tok-a'])
  })
})

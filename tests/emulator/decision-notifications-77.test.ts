// decision-notifications 77 in the Firestore emulator (`npm run test:rules`): posting a spec for
// approval (setSubtask spec -> awaiting_approval) sends each registered device one notification,
// titled "Spec · <project name>", with the deck's headline for the spec card as its text.
import { beforeEach, describe, expect, it } from 'vitest'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  deviceTokens,
  fakePush,
  projectName,
  readTask,
  seedDevices,
  taskAt,
  useBoard,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-77', push)
beforeEach(() => push.reset())

const newSpecTask = (title: string) => board().createTask({ title, type: 'feature' })

describe('decision-notifications 77: posting a spec', () => {
  it('sends every device one notification titled "Spec · <project>" with the Yes: line', async () => {
    await seedDevices(board(), ['tok-a', 'tok-b'])
    const t = await newSpecTask('Notify me')
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'Start building notifications for decision cards' })
    )
    const name = await projectName(board())
    expect(push.calls).toHaveLength(1)
    expect(push.calls[0].notice).toMatchObject({
      kind: 'spec',
      title: `Spec · ${name}`,
      body: 'Start building notifications for decision cards',
      tag: `decision:${t.id}`,
      url: `/?task=${t.id}`,
    })
    expect([...push.calls[0].tokens].sort()).toEqual(['tok-a', 'tok-b'])
    // The call still did its usual work.
    expect((await readTask(board(), t.id)).needs).toEqual({ kind: 'spec' })
  })

  it('falls back to "Start building: <task title>" when the note is not a spec brief', async () => {
    await seedDevices(board(), ['tok-a'])
    const t = await newSpecTask('Order the replies')
    await board().setSubtask(t.id, 'spec', 'awaiting_approval')
    expect(push.calls).toHaveLength(1)
    expect(push.calls[0].notice.body).toBe('Start building: Order the replies')
    push.reset()
    const u = await newSpecTask('Another one')
    await board().setSubtask(
      u.id,
      'spec',
      'awaiting_approval',
      briefText('fix', { yes: 'Mend it' })
    )
    expect(push.calls[0].notice.body).toBe('Start building: Another one')
  })

  it('cuts a long Yes: line to 60 characters the way the card does', async () => {
    await seedDevices(board(), ['tok-a'])
    const t = await newSpecTask('Long one')
    await board().setSubtask(
      t.id,
      'spec',
      'awaiting_approval',
      briefText('spec', { yes: 'q'.repeat(80) })
    )
    expect(push.calls[0].notice.body).toBe(`${'q'.repeat(59)}…`)
  })

  it('sends nothing for the spec step in any other status', async () => {
    await seedDevices(board(), ['tok-a'])
    const t = await newSpecTask('Quiet steps')
    await board().setSubtask(t.id, 'spec', 'in_progress')
    await board().setSubtask(t.id, 'spec', 'done')
    expect(push.calls).toHaveLength(0)
    expect(await deviceTokens(board())).toEqual(['tok-a'])
  })

  it('uses only the devices that hold a valid token', async () => {
    await seedDevices(board(), ['tok-a'])
    await board()
      .db.collection('devices')
      .doc('bad-empty')
      .set({ token: '', createdAt: 1, updatedAt: 1 })
    await board()
      .db.collection('devices')
      .doc('bad-type')
      .set({ token: 7, createdAt: 1, updatedAt: 1 })
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(t.id, 'spec', 'awaiting_approval')
    expect(push.calls).toHaveLength(1)
    expect(push.calls[0].tokens).toEqual(['tok-a'])
  })
})

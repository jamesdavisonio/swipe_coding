// decision-notifications 81 in the Firestore emulator (`npm run test:rules`): with no registered
// device the session's tool call behaves exactly as before (same stored decision, same comment,
// same result) and nothing is sent.
import { beforeEach, describe, expect, it } from 'vitest'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  clearDevices,
  fakePush,
  readComments,
  readTask,
  taskAt,
  useBoard,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-81', push)
beforeEach(async () => {
  push.reset()
  await clearDevices(board())
})

describe('decision-notifications 81: no devices', () => {
  it('posting a spec stores it as before and sends nothing', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    const note = briefText('spec', { yes: 'Start building' })
    const result = await board().setSubtask(t.id, 'spec', 'awaiting_approval', note)
    expect(result.needs).toEqual({ kind: 'spec' })
    expect((await readTask(board(), t.id)).needs).toEqual({ kind: 'spec' })
    expect((await readComments(board(), t.id)).map((c) => c.body)).toEqual([note.trim()])
    expect(push.calls).toHaveLength(0)
  })

  it('asking a question stores it as before and sends nothing', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    const c = await board().ask(t.id, 'Which branch?')
    expect(c).toMatchObject({ taskId: t.id, kind: 'question', body: 'Which branch?' })
    expect((await readTask(board(), t.id)).needs).toEqual({
      kind: 'question',
      question: 'Which branch?',
    })
    expect(push.calls).toHaveLength(0)
  })

  it('a devices collection holding only unusable documents counts as no devices', async () => {
    await board()
      .db.collection('devices')
      .doc('empty')
      .set({ token: '', createdAt: 1, updatedAt: 1 })
    await board().db.collection('devices').doc('none').set({ createdAt: 1, updatedAt: 1 })
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Anything?')
    expect(push.calls).toHaveLength(0)
  })
})

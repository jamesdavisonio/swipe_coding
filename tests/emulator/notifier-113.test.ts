// notifier 113 in the Firestore emulator (`npm run test:rules`): session agents no longer send
// decision notifications. kanban_subtask spec -> awaiting_approval (Board.setSubtask) and
// kanban_ask (Board.ask) write the decision exactly as before and send nothing: no notifyDecision
// call, no push port used, and no notifier runs in this file.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  readComments,
  readTask,
  seedDevices,
  taskAt,
  useBoard,
} from '../fixtures/board-briefs-b7-emulator.ts'

// Whatever the Board would send through: every use is recorded, nothing is sent.
const used = vi.hoisted(() => ({ notifyDecision: [] as unknown[][], port: [] as unknown[][] }))
vi.mock('../../packages/agent/src/push.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../packages/agent/src/push.ts')>()),
  notifyDecision: (...args: unknown[]) => {
    used.notifyDecision.push(args)
    return Promise.resolve()
  },
  fcmPush: () => ({
    sendDecision: (...args: unknown[]) => {
      used.port.push(args)
      return Promise.resolve([])
    },
  }),
}))

const board = useBoard('113')
beforeEach(async () => {
  used.notifyDecision.length = 0
  used.port.length = 0
  await seedDevices(board(), ['tok-a', 'tok-b'])
})

describe('notifier 113: session agents send nothing', () => {
  it('posting a spec writes the decision as before and sends nothing', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    const note = briefText('spec', { yes: 'Start building' })
    const result = await board().setSubtask(t.id, 'spec', 'awaiting_approval', note)
    expect(result.needs).toEqual({ kind: 'spec' })
    expect((await readTask(board(), t.id)).needs).toEqual({ kind: 'spec' })
    expect((await readComments(board(), t.id)).map((c) => c.body)).toEqual([note.trim()])
    expect(used.notifyDecision).toHaveLength(0)
    expect(used.port).toHaveLength(0)
  })

  it('posting a spec without a note writes the decision as before and sends nothing', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'spec' })
    await board().setSubtask(t.id, 'spec', 'awaiting_approval')
    expect((await readTask(board(), t.id)).needs).toEqual({ kind: 'spec' })
    expect(used.notifyDecision).toHaveLength(0)
    expect(used.port).toHaveLength(0)
  })

  it.each([
    ['a question', undefined, { kind: 'question', question: 'Which branch?' }],
    [
      'a question with options',
      ['Serif', 'Sans'],
      {
        kind: 'question',
        question: 'Which branch?',
        options: [
          { key: 'a', label: 'Serif' },
          { key: 'b', label: 'Sans' },
        ],
      },
    ],
  ])('asking %s writes the decision as before and sends nothing', async (_n, options, needs) => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    const c = await board().ask(t.id, 'Which branch?', options)
    expect(c).toMatchObject({ taskId: t.id, kind: 'question', body: 'Which branch?' })
    expect((await readTask(board(), t.id)).needs).toEqual(needs)
    expect(used.notifyDecision).toHaveLength(0)
    expect(used.port).toHaveLength(0)
  })
})

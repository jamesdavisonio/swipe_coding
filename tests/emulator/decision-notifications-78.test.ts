// decision-notifications 78 in the Firestore emulator (`npm run test:rules`): a session's
// question (Board.ask, with or without options) sends each registered device one notification
// titled "<kind label> · <project name>" with the deck's headline for that card.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Stage } from '../../packages/shared/src/index.ts'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  fakePush,
  projectName,
  seedDevices,
  taskAt,
  useBoard,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-78', push)
beforeEach(async () => {
  push.reset()
  await seedDevices(board(), ['tok-a', 'tok-b'])
})

const cases: [string, Stage, string, string, string][] = [
  ['a fix brief', 'build', briefText('fix', { yes: 'Mend the export' }), 'Fix', 'Mend the export'],
  [
    'a CI fix brief',
    'pr',
    briefText('fix', { yes: 'Fix the lint error' }),
    'CI failed',
    'Fix the lint error',
  ],
  ['a round brief', 'build', briefText('round', { yes: 'Go again' }), 'Another round', 'Go again'],
  [
    'a summary brief',
    'build',
    briefText('summary', { yes: 'Ship the footer' }),
    'Ship it',
    'Ship the footer',
  ],
  ['a plain question', 'build', 'What should we call it?', 'Question', 'What should we call it?'],
]

describe('decision-notifications 78: asking a question', () => {
  it.each(cases)(
    '%s notifies each device once with the deck headline',
    async (_n, stage, question, label, body) => {
      const t = await taskAt(board(), 'feature', { stage })
      await board().ask(t.id, question)
      const name = await projectName(board())
      expect(push.calls).toHaveLength(1)
      expect(push.calls[0].notice).toMatchObject({
        title: `${label} · ${name}`,
        body,
        tag: `decision:${t.id}`,
        url: `/?task=${t.id}`,
      })
      expect([...push.calls[0].tokens].sort()).toEqual(['tok-a', 'tok-b'])
    }
  )

  it('notifies for a question with options, titled "Question"', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Which font?', ['Serif', 'Sans'])
    const name = await projectName(board())
    expect(push.calls).toHaveLength(1)
    expect(push.calls[0].notice).toMatchObject({ title: `Question · ${name}`, body: 'Which font?' })
  })

  it('sends nothing when the options are refused and nothing is written', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await expect(board().ask(t.id, 'Which?', ['only one'])).rejects.toThrow()
    expect(push.calls).toHaveLength(0)
  })
})

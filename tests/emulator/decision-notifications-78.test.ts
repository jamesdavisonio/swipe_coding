// decision-notifications 78 in the Firestore emulator (`npm run test:rules`): a session's
// question (Board.ask, with or without options) is sent by the notifier (docs/features/notifier.md)
// to each registered device as one notification titled "<kind label> · <project name>" with the
// deck's headline for that card.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Stage } from '../../packages/shared/src/index.ts'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  fakePush,
  projectName,
  seedDevices,
  sentFor,
  settle,
  taskAt,
  useBoard,
  useNotifier,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-78')
const db = useNotifier(push)
beforeEach(async () => {
  push.reset()
  await seedDevices(db(), ['tok-a', 'tok-b'])
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
      await waitForSends(push, t.id)
      await settle(db(), push)
      const calls = sentFor(push, t.id)
      const name = await projectName(board())
      expect(calls).toHaveLength(1)
      expect(calls[0].notice).toMatchObject({
        title: `${label} · ${name}`,
        body,
        tag: `decision:${t.id}`,
        url: `/?task=${t.id}`,
      })
      expect([...calls[0].tokens].sort()).toEqual(['tok-a', 'tok-b'])
    }
  )

  it('notifies for a question with options, titled "Question"', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().ask(t.id, 'Which font?', ['Serif', 'Sans'])
    await waitForSends(push, t.id)
    await settle(db(), push)
    const calls = sentFor(push, t.id)
    const name = await projectName(board())
    expect(calls).toHaveLength(1)
    expect(calls[0].notice).toMatchObject({ title: `Question · ${name}`, body: 'Which font?' })
  })

  it('sends nothing when the options are refused and nothing is written', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await expect(board().ask(t.id, 'Which?', ['only one'])).rejects.toThrow()
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
  })
})

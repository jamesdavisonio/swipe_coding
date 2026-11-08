// notifier 108 in the Firestore emulator (`npm run test:rules`): while the notifier runs and
// devices are registered, a task whose need becomes a question (with or without options), written
// by any agent version through any path, sends each device one notification equal to
// decisionNotice(task, <project name>): the deck's kind and headline (CI failed, Fix, Another
// round, Ship it, Question).
import { beforeEach, describe, expect, it } from 'vitest'
import { decisionNotice, type Stage, type TaskNeed } from '../../packages/shared/src/index.ts'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  NOTIFIER_PROJECT,
  fakePush,
  patchTask,
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

const cases: [string, Stage, string, string][] = [
  ['a fix brief', 'build', briefText('fix', { yes: 'Mend the export' }), 'Fix'],
  ['a CI fix brief', 'pr', briefText('fix', { yes: 'Fix the lint error' }), 'CI failed'],
  ['a round brief', 'build', briefText('round', { yes: 'Go again' }), 'Another round'],
  ['a summary brief', 'build', briefText('summary', { yes: 'Ship the footer' }), 'Ship it'],
  ['a plain question', 'build', 'What should we call it?', 'Question'],
]

describe('notifier 108: a need that becomes a question', () => {
  it.each(cases)(
    '%s notifies each device once with the deck headline',
    async (_n, stage, q, label) => {
      const task = await putTask(db(), { stage })
      const needs: TaskNeed = { kind: 'question', question: q }
      await patchTask(db(), task.id, { needs })
      await waitForSends(push, task.id)
      await settle(db(), push)
      const calls = sentFor(push, task.id)
      expect(calls).toHaveLength(1)
      expect(calls[0].notice).toEqual(decisionNotice({ ...task, needs }, NOTIFIER_PROJECT.name))
      expect(calls[0].notice.title).toBe(`${label} · ${NOTIFIER_PROJECT.name}`)
      expect([...calls[0].tokens].sort()).toEqual(['tok-a', 'tok-b'])
    }
  )

  it('a question with options is notified the same way, titled "Question"', async () => {
    const needs: TaskNeed = {
      kind: 'question',
      question: 'Which font?',
      options: [
        { key: 'serif', label: 'Serif' },
        { key: 'sans', label: 'Sans' },
      ],
    }
    const task = await putTask(db(), { needs })
    const [call] = await waitForSends(push, task.id)
    expect(call.notice).toEqual(decisionNotice({ ...task }, NOTIFIER_PROJECT.name))
    expect(call.notice.title).toBe(`Question · ${NOTIFIER_PROJECT.name}`)
  })

  it('the same question asked again after its need was cleared notifies again', async () => {
    const needs: TaskNeed = { kind: 'question', question: 'Again?' }
    const task = await putTask(db(), { needs })
    await waitForSends(push, task.id, 1)
    await waitFor(
      async () => (await db().collection('tasks').doc(task.id).get()).get('notified') as string,
      'notified on the task'
    )
    await patchTask(db(), task.id, { needs: null })
    await waitFor(
      async () => !(await db().collection('tasks').doc(task.id).get()).get('notified'),
      'notified to be removed'
    )
    await patchTask(db(), task.id, { needs })
    await waitForSends(push, task.id, 2)
    await settle(db(), push)
    expect(sentFor(push, task.id)).toHaveLength(2)
  })

  it('records the decision on the task as question:<the question text>', async () => {
    const task = await putTask(db(), { needs: { kind: 'question', question: 'Which branch?' } })
    await waitForSends(push, task.id)
    const stored = await waitFor(
      async () => (await db().collection('tasks').doc(task.id).get()).get('notified') as string,
      'notified on the task'
    )
    expect(stored).toBe('question:Which branch?')
  })
})

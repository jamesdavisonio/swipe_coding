// web-threads B4, criterion 17, in the Firestore emulator (`npm run test:rules`): what
// answerQuestion stores when James answers, read back as James through the real rules. The
// answer (an option's label, or his own words) is his message of kind answer; the history says
// "Answered <question>: <answer>" ("Answered: <answer>" without question text); the need is
// cleared. A guarded transaction: a cleared need or an option no longer offered writes nothing.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  FULL_LOG,
  LOG_CAP,
  expectUntouched,
  lastEntry,
  makeTask,
  readArchive,
  readComments,
  readTask,
  seedTask,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const QUESTION = 'Which font should we use?'
const OPTIONS = [
  { key: 'A', label: 'Inter' },
  { key: 'B', label: 'Atkinson' },
]
const questionTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', {
    stage: 'build',
    needs: { kind: 'question', question: QUESTION, options: OPTIONS },
    ...over,
  })

describe('B4-17 answerQuestion in the emulator', () => {
  useEmulator()

  it('an option: sends its label as the answer, records it and clears the need', async () => {
    const task = await seedTask(questionTask())
    await data.answerQuestion(task, { key: 'B', label: 'Atkinson' })
    const stored = await readTask('t1')
    expect(stored.needs).toBeNull()
    expect(stored.stage).toBe('build')
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: `Answered ${QUESTION}: Atkinson` })
    )
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        projectId: 'p1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'answer',
        body: 'Atkinson',
      })
    )
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
  })

  it('his own words: trimmed, sent as the answer and recorded', async () => {
    const task = await seedTask(questionTask())
    await data.answerQuestion(task, { label: '  Use the system font  ' })
    const stored = await readTask('t1')
    expect(stored.needs).toBeNull()
    expect(lastEntry(stored)?.text).toBe(`Answered ${QUESTION}: Use the system font`)
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0].kind).toBe('answer')
    expect(comments[0].body).toBe('Use the system font')
  })

  it('records "Answered: <answer>" when the need has no question text', async () => {
    const task = await seedTask(questionTask({ needs: { kind: 'question', options: OPTIONS } }))
    await data.answerQuestion(task, { key: 'A', label: 'Inter' })
    expect(lastEntry(await readTask('t1'))?.text).toBe('Answered: Inter')
  })

  it('caps his own words at 4000 characters', async () => {
    const task = await seedTask(questionTask())
    await data.answerQuestion(task, { label: 'y'.repeat(5000) })
    const [comment] = await readComments('t1')
    expect(comment.body).toBe('y'.repeat(4000))
    const text = lastEntry(await readTask('t1'))?.text ?? ''
    expect(text.startsWith(`Answered ${QUESTION}: yyy`)).toBe(true)
    expect(text.length).toBeLessThanOrEqual(`Answered ${QUESTION}: `.length + 4000)
  })

  it('writes nothing for empty or whitespace-only words', async () => {
    const task = await seedTask(questionTask())
    await data.answerQuestion(task, { label: '' })
    await data.answerQuestion(task, { label: '   ' })
    await expectUntouched(task)
  })

  it('writes nothing for an option the question no longer offers', async () => {
    const onScreen = questionTask()
    const current = await seedTask(
      questionTask({ needs: { kind: 'question', question: QUESTION, options: [OPTIONS[0]] } })
    )
    await data.answerQuestion(onScreen, { key: 'B', label: 'Atkinson' })
    await expectUntouched(current)
  })

  it('writes nothing when the task no longer waits on a question', async () => {
    const onScreen = questionTask()
    const current = await seedTask(questionTask({ needs: { kind: 'pr' }, stage: 'pr' }))
    await data.answerQuestion(onScreen, { key: 'A', label: 'Inter' })
    await expectUntouched(current)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(questionTask())
    await data.answerQuestion(task, { key: 'A', label: 'Inter' })
    await data.answerQuestion(task, { key: 'A', label: 'Inter' })
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(questionTask({ log: FULL_LOG() }))
    await data.answerQuestion(task, { key: 'A', label: 'Inter' })
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 1')
    expect(lastEntry(stored)?.text).toBe(`Answered ${QUESTION}: Inter`)
    expect((await readArchive('t1')).map((e) => e.text)).toEqual(['Entry 0'])
  })
})

// Repro for the lost spec card (2026-11-09, DT "Support ticket: confirmation email…"): the session
// put its spec up for approval and 0.1 s later asked a question with kanban_ask. A task waits on
// one thing at a time, so the question replaced the spec approval; James's answer cleared the
// need, and the spec card never came back.
//
// Expected: a question asked while the task waits on its spec is answered first; once it is
// answered (on the phone, by a voice note, or recorded from the session's chat), the task waits on
// its spec again. A question asked on a task that waits on anything else is cleared by its answer,
// as before. Runs the real Board and the web data layer against the Firestore emulator.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import type { Task } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'
import { readTask as readAdmin, taskAt } from '../fixtures/board-briefs-b7-emulator.ts'
import { readTask as readStored, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

useEmulator() // clears the database before each test, so each test registers its own session
let session: Board | null = null
beforeEach(async () => {
  session = new Board(`/tmp/question-keeps-spec-${Date.now()}`)
  await session.register()
})
afterEach(async () => {
  await session?.shutdown()
  session = null
})
const board = (): Board => {
  if (!session) throw new Error('no session registered')
  return session
}
const readWeb = async (id: string): Promise<Task> => ({ ...(await readStored(id)), id })
const QUESTION = 'What reply time should the confirmation email promise?'

async function specWaitingThenAsked(): Promise<Task> {
  const task = await taskAt(board(), 'feature', { stage: 'spec', needs: { kind: 'spec' } })
  await board().ask(task.id, QUESTION, ['Within one business day', 'Within two days'])
  return readWeb(task.id)
}

describe('fix: a question asked while the spec waits does not drop the spec approval', () => {
  it('the question shows first', async () => {
    const asked = await specWaitingThenAsked()
    expect(asked.needs?.kind).toBe('question')
    expect(asked.stage).toBe('spec')
  })

  it('answering it on the phone brings the spec approval back', async () => {
    const asked = await specWaitingThenAsked()
    await data.answerQuestion(asked, { label: 'Within one business day' })
    const stored = await readAdmin(board(), asked.id)
    expect(stored.needs).toEqual({ kind: 'spec' })
    expect(stored.stage).toBe('spec')
  })

  it('answering it by a voice or typed note brings the spec approval back', async () => {
    const asked = await specWaitingThenAsked()
    await data.sendNote(asked, 'one business day')
    expect((await readAdmin(board(), asked.id)).needs).toEqual({ kind: 'spec' })
  })

  it('an answer recorded from the session chat brings the spec approval back', async () => {
    const asked = await specWaitingThenAsked()
    await board().answeredInSession(asked.id, 'Within one business day')
    expect((await readAdmin(board(), asked.id)).needs).toEqual({ kind: 'spec' })
  })

  it('a question on a task that waits on nothing else is cleared by its answer, as before', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'build', needs: null })
    await board().ask(task.id, QUESTION)
    await data.answerQuestion(await readWeb(task.id), { label: 'Within two days' })
    expect((await readAdmin(board(), task.id)).needs).toBeNull()
  })
})

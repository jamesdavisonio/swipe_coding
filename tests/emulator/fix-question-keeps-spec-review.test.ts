// Added after the freeze with James's approval ("another round", 2026-11-09), for the two holes the
// review of fix-question-keeps-spec found, plus the thread composer path:
// 1. the session's watcher claims James's answer about a second later; claiming it must not wipe
//    the spec approval the answer brought back;
// 2. once the spec stage is passed (James confirmed the spec in the session chat and the session
//    marked spec and approved done), answering the open question must not bring back a spec card
//    that can no longer be approved;
// 3. an answer typed in the thread's reply box (sendReply) brings the spec back like the others.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import type { Task } from '../../packages/shared/src/index.ts'
import { Board, claimReplies } from '../../packages/agent/src/board.ts'
import {
  readComments,
  readTask as readAdmin,
  taskAt,
} from '../fixtures/board-briefs-b7-emulator.ts'
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
  session = new Board(`/tmp/question-keeps-spec-review-${Date.now()}`)
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

// What the session's watcher does (wait.ts): claim James's replies waiting for this session.
async function watcherClaims(taskId: string) {
  const waiting = (await readComments(board(), taskId)).filter(
    (c) => c.author === 'james' && c.deliveredAt === null
  )
  expect(waiting.length).toBeGreaterThan(0)
  await claimReplies(
    board().db,
    board().id.agentId,
    waiting.map((c) => c.id)
  )
}

describe('fix review: the spec approval survives the watcher and ends with the spec stage', () => {
  it('the watcher claiming the answer keeps the spec approval that came back', async () => {
    const asked = await specWaitingThenAsked()
    await data.answerQuestion(asked, { label: 'Within one business day' })
    await watcherClaims(asked.id)
    expect((await readAdmin(board(), asked.id)).needs).toEqual({ kind: 'spec' })
  })

  it('once the spec is approved in the chat, answering the question brings no spec card back', async () => {
    const asked = await specWaitingThenAsked()
    await board().setSubtask(asked.id, 'spec', 'done')
    await board().setSubtask(asked.id, 'approved', 'done')
    const approved = await readWeb(asked.id)
    expect(approved.stage).toBe('build')
    await data.answerQuestion(approved, { label: 'Within one business day' })
    expect((await readAdmin(board(), asked.id)).needs).toBeNull()
  })

  it('an answer from the thread reply box brings the spec back, and the watcher keeps it', async () => {
    const asked = await specWaitingThenAsked()
    await data.sendReply(asked, { id: data.newCommentId(), body: 'one business day' })
    expect((await readAdmin(board(), asked.id)).needs).toEqual({ kind: 'spec' })
    await watcherClaims(asked.id)
    expect((await readAdmin(board(), asked.id)).needs).toEqual({ kind: 'spec' })
  })
})

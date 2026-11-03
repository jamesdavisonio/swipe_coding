// web-threads criterion 14's write (B3's sendReply), in the Firestore emulator (`npm run
// test:rules`): James's reply is his comment under the id the screen chose, trimmed and capped;
// it is the answer (kind answer, need cleared in the same write) while the task waits on a
// question, otherwise a plain comment with the need left alone. The rules accept it as James, and
// a retried write lands on the same document.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  T0,
  makeTask,
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

const question = { kind: 'question' as const, question: 'Which font?' }

describe('B3-14 sendReply in the emulator', () => {
  useEmulator()

  it('answers a waiting question: kind answer under the given id, need cleared', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'build', needs: question }))
    await data.sendReply(task, { id: 'c-reply-1', body: '  Go with Inter  ' })
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        id: 'c-reply-1',
        taskId: 't1',
        projectId: 'p1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'answer',
        body: 'Go with Inter',
        deliveredAt: null,
      })
    )
    const stored = await readTask('t1')
    expect(stored.needs).toBeNull()
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
    expect(stored.updatedAt).toBeGreaterThan(T0)
  })

  it('otherwise sends a plain comment and leaves the need as it is', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'spec', needs: { kind: 'spec' } }))
    await data.sendReply(task, { id: 'c-reply-2', body: 'Looks good so far' })
    const [comment] = await readComments('t1')
    expect(comment).toEqual(
      expect.objectContaining({ id: 'c-reply-2', kind: 'comment', body: 'Looks good so far' })
    )
    const stored = await readTask('t1')
    expect(stored.needs).toEqual({ kind: 'spec' })
    expect(stored.stage).toBe('spec')
  })

  it('caps the body at 4000 characters', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'build' }))
    await data.sendReply(task, { id: 'c-long', body: 'z'.repeat(5000) })
    const [comment] = await readComments('t1')
    expect(comment.body).toBe('z'.repeat(4000))
  })

  it('a retried write with the same id leaves one message', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'build' }))
    await data.sendReply(task, { id: 'c-retry', body: 'Hello' })
    await data.sendReply(task, { id: 'c-retry', body: 'Hello' })
    const comments = await readComments('t1')
    expect(comments.map((c) => c.id)).toEqual(['c-retry'])
  })
})

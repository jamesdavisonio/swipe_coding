// board-replies-anywhere R1, criterion 2: a running watcher prints James's comment or answer on a
// task bound to its session within a few seconds, as one compact JSON line (task, kind, id, from,
// text verbatim) and nothing else on stdout, then exits 0. It prints only its own session's
// unmarked replies, and never registers as an agent. The watcher spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  QUESTION,
  finished,
  oneWatcherRun,
  postReply,
  readComment,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const TEXT = 'Go with "plan B" — café hours:\n  09:00–17:00\n\\o/ {"not":"json"}'

describe('R1-2 a waiting watcher prints a reply and exits', () => {
  it('a comment: one exact line within a few seconds, exit 0, nobody else’s', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s)
    const other = await seedTask(db(), await seedSession(db()))
    const elsewhere = await postReply(db(), other, 'comment', 'for another session')
    const seen = await postReply(db(), task, 'comment', 'already received')
    await db().collection('comments').doc(seen).update({ deliveredAt: 1 })
    // Not James's: a session comment is never a reply, even unmarked.
    await db().collection('comments').add({
      taskId: task.id,
      projectId: task.projectId,
      agentId: s.agentId,
      author: 'agent',
      kind: 'info',
      body: 'session note',
      createdAt: Date.now(),
      deliveredAt: null,
    })
    const agentBefore = (await db().collection('agents').doc(s.agentId).get()).data()

    const w = startWatcher(['--agent', s.agentId])
    await oneWatcherRun(db())
    const sentAt = Date.now()
    const id = await postReply(db(), task, 'comment', TEXT)
    const run = await finished(w, 10_000)

    expect(Date.now() - sentAt).toBeLessThan(5_000)
    expect(run.lines).toEqual([replyLine(task.id, 'comment', id, TEXT)])
    expect(run.code).toBe(0)
    expect((await readComment(db(), elsewhere)).deliveredAt).toBeNull()
    expect((await db().collection('agents').doc(s.agentId).get()).data()).toEqual(agentBefore)
    expect((await db().collection('agents').where('pid', '==', w.pid).get()).empty).toBe(true)
  }, 40_000)

  it('an answer to the open question: printed with kind "answer"', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s, { needs: QUESTION })
    const w = startWatcher(['--agent', s.agentId])
    await oneWatcherRun(db())
    const id = await postReply(db(), task, 'answer', 'main')
    const run = await finished(w, 10_000)
    expect(run.lines).toEqual([replyLine(task.id, 'answer', id, 'main')])
    expect(run.code).toBe(0)
  }, 40_000)
})

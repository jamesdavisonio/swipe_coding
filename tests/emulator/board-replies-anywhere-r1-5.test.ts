// board-replies-anywhere R1, criterion 5: with no watcher running, James's reply waits on the
// board, unmarked and with its question still open, and the next watcher the session starts
// prints it. The watcher spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  QUESTION,
  finished,
  oneWatcherRun,
  postReply,
  readComment,
  readTask,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-5 a reply with no watcher waits for the next one', () => {
  it('between watchers: the reply stays unmarked, then the next watcher prints it', async () => {
    const s = await seedSession(db())
    const earlier = await seedTask(db(), s)
    const task = await seedTask(db(), s, { needs: QUESTION })
    const before = await postReply(db(), earlier, 'comment', 'before')
    const first = await finished(startWatcher(['--agent', s.agentId]))
    expect(first.lines).toEqual([replyLine(earlier.id, 'comment', before, 'before')])

    // That watcher has exited and none is running for the session.
    const answer = await postReply(db(), task, 'answer', 'release branch')
    await oneWatcherRun(db())
    expect((await readComment(db(), answer)).deliveredAt).toBeNull()
    expect((await readTask(db(), task.id)).needs).toEqual(QUESTION)

    const next = await finished(startWatcher(['--agent', s.agentId]))
    expect(next.lines).toEqual([replyLine(task.id, 'answer', answer, 'release branch')])
    expect(next.code).toBe(0)
    expect((await readComment(db(), answer)).deliveredAt).toEqual(expect.any(Number))
    expect((await readTask(db(), task.id)).needs).toBeNull()
  }, 40_000)
})

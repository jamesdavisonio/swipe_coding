// board-replies-anywhere R1, criterion 3: replies already waiting when the watcher starts, or
// several arriving close together (within WATCHER_SETTLE_MS = 1000 of the first), are all printed
// by one run, oldest first by createdAt, each exactly once, then the watcher exits. The watcher
// spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  finished,
  oneWatcherRun,
  postReply,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-3 every waiting reply, oldest first, once', () => {
  it('the settle time is the shared WATCHER_SETTLE_MS, 1000 ms', async () => {
    const shared = (await import('../../packages/shared/src/index.ts')) as Record<string, unknown>
    expect(shared.WATCHER_SETTLE_MS).toBe(1000)
  })

  it('replies waiting at start, across tasks: all in createdAt order; the next run has none of them', async () => {
    const s = await seedSession(db())
    const a = await seedTask(db(), s)
    const b = await seedTask(db(), s)
    const t = Date.now() - 60_000
    // Written out of order: the order printed is createdAt's, not the writes'.
    const third = await postReply(db(), a, 'comment', 'third', t + 3)
    const first = await postReply(db(), b, 'comment', 'first', t + 1)
    const second = await postReply(db(), a, 'comment', 'second', t + 2)

    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines).toEqual([
      replyLine(b.id, 'comment', first, 'first'),
      replyLine(a.id, 'comment', second, 'second'),
      replyLine(a.id, 'comment', third, 'third'),
    ])
    expect(run.code).toBe(0)

    const again = startWatcher(['--agent', s.agentId])
    const later = await postReply(db(), b, 'comment', 'later')
    const next = await finished(again)
    expect(next.lines).toEqual([replyLine(b.id, 'comment', later, 'later')])
    expect(next.code).toBe(0)
  }, 40_000)

  it('a burst arriving while it waits comes out together, in order', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s)
    const w = startWatcher(['--agent', s.agentId])
    await oneWatcherRun(db())
    const ids = [
      await postReply(db(), task, 'comment', 'one'),
      await postReply(db(), task, 'comment', 'two'),
      await postReply(db(), task, 'comment', 'three'),
    ]
    const run = await finished(w, 10_000)
    expect(run.lines).toEqual(
      ['one', 'two', 'three'].map((text, i) => replyLine(task.id, 'comment', ids[i], text))
    )
    expect(run.code).toBe(0)
  }, 40_000)
})

// board-replies-anywhere R1, criterion 4: a reply the watcher printed is marked received (the
// phone's "received" tick, deliveryState 'delivered') and, when it answers the open question, the
// question stops asking for James, by today's rule (kind answer, or any reply while the need is a
// question; updatedAt set either way). A reply no watcher printed stays unmarked. The watcher
// spawned against the emulator; the board read back with the admin db.
import { describe, expect, it } from 'vitest'
import { deliveryState } from '../../packages/shared/src/index.ts'
import {
  QUESTION,
  finished,
  postReply,
  readComment,
  readTask,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-4 printed means received', () => {
  it('marks what it printed and clears the question it answers, as today', async () => {
    const s = await seedSession(db())
    const asked = await seedTask(db(), s, { needs: QUESTION, updatedAt: 1 })
    const askedToo = await seedTask(db(), s, { needs: QUESTION, updatedAt: 1 })
    const spec = await seedTask(db(), s, { needs: { kind: 'spec' }, updatedAt: 1 })
    const ids = [
      await postReply(db(), asked, 'answer', 'main'),
      await postReply(db(), askedToo, 'comment', 'use main'),
      await postReply(db(), spec, 'comment', 'reading it now'),
    ]
    const before = Date.now()
    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines).toHaveLength(3)
    expect(run.code).toBe(0)

    for (const id of ids) {
      const c = await readComment(db(), id)
      expect(deliveryState(c)).toBe('delivered')
      expect(c.deliveredAt).toBeGreaterThanOrEqual(before)
    }
    for (const t of [asked, askedToo, spec]) {
      const stored = await readTask(db(), t.id)
      expect(stored.updatedAt).toBeGreaterThanOrEqual(before)
      expect(stored.needs).toEqual(t === spec ? { kind: 'spec' } : null)
    }
  }, 30_000)

  it('another session’s reply it did not print stays unmarked, its question still open', async () => {
    const s = await seedSession(db())
    const mine = await postReply(db(), await seedTask(db(), s), 'comment', 'mine')
    const theirs = await seedTask(db(), await seedSession(db()), { needs: QUESTION })
    const notMine = await postReply(db(), theirs, 'answer', 'not yours')

    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines.map((l) => (JSON.parse(l) as { id: string }).id)).toEqual([mine])
    expect(run.code).toBe(0)
    expect(deliveryState(await readComment(db(), notMine))).toBe('sent')
    expect((await readTask(db(), theirs.id)).needs).toEqual(QUESTION)
  }, 30_000)
})

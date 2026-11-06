// board-replies-anywhere R1, criterion 6: two watchers for the same session at once print each
// reply exactly once between them (claiming is one transaction; a watcher whose replies were all
// claimed by the other goes back to waiting). The watchers spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  finished,
  oneWatcherRun,
  postReply,
  readComment,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
  type WatcherExit,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-6 two watchers, one session: each reply printed once', () => {
  it.each([
    ['replies already waiting when both start', false],
    ['replies arriving while both wait', true],
  ])(
    '%s',
    async (_name, bothWaitFirst) => {
      const s = await seedSession(db())
      const tasks = [await seedTask(db(), s), await seedTask(db(), s)]
      const expected: string[] = []
      const post = async (i: number, text: string) => {
        const task = tasks[i % 2]
        expected.push(
          replyLine(task.id, 'comment', await postReply(db(), task, 'comment', text), text)
        )
      }
      if (!bothWaitFirst) for (let i = 0; i < 3; i++) await post(i, `reply ${i}`)
      const watchers = [startWatcher(['--agent', s.agentId]), startWatcher(['--agent', s.agentId])]
      if (bothWaitFirst) {
        await oneWatcherRun(db())
        for (let i = 0; i < 3; i++) await post(i, `reply ${i}`)
      }

      // Once one has exited, a last reply lets one still waiting finish; if neither is, a third
      // watcher picks that reply up.
      await finished({ exited: Promise.race(watchers.map((w) => w.exited)) })
      await post(3, 'last')
      const runs: WatcherExit[] = []
      for (const w of watchers) runs.push(await finished(w))
      if (!runs.some((r) => r.lines.includes(expected[3])))
        runs.push(await finished(startWatcher(['--agent', s.agentId])))

      expect(runs.flatMap((r) => r.lines).sort()).toEqual([...expected].sort())
      // A watcher whose replies were all claimed by the other goes back to waiting: no run ends
      // having printed nothing.
      for (const r of runs) expect(r.lines).not.toHaveLength(0)
      for (const r of runs) expect(r.code).toBe(0)
      for (const line of expected) {
        const { id } = JSON.parse(line) as { id: string }
        expect((await readComment(db(), id)).deliveredAt).toEqual(expect.any(Number))
      }
    },
    60_000
  )
})

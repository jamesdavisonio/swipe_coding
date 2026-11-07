// swipe-deck 66 in the Firestore emulator (`npm run test:rules`): Board.retireSuggestions adds
// indices to `retiredNext` without duplicates, one write per source task, and refuses malformed
// ids, another project's tasks, unfinished tasks, indices past the list and unknown tasks, writing
// nothing for them. updateTask({ retire_suggestions }) retires too, with no other field needed.
// updateTask returns a Task, so the `retired` / `refused` reply is checked on retireSuggestions.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBoard } from '../fixtures/board-briefs-b7-emulator.ts'
import { readStored, seedDone, watchTaskWrites } from '../fixtures/retire-suggestions-emulator.ts'

const board = useBoard('retire-66')
afterEach(() => vi.restoreAllMocks())

describe('swipe-deck 66: retireSuggestions', () => {
  it('retires into retiredNext and replies with the retired ids', async () => {
    const t = await seedDone(board())
    const reply = await board().retireSuggestions([`${t.id}:0`, `${t.id}:2`])
    expect([...reply.retired].sort()).toEqual([`${t.id}:0`, `${t.id}:2`])
    expect(reply.refused).toEqual([])
    expect([...((await readStored(board(), t.id)).retiredNext ?? [])].sort()).toEqual([0, 2])
  })

  it('retiring twice changes nothing: no duplicates', async () => {
    const t = await seedDone(board(), { retiredNext: [1] })
    await board().retireSuggestions([`${t.id}:1`, `${t.id}:1`])
    await board().retireSuggestions([`${t.id}:1`])
    expect((await readStored(board(), t.id)).retiredNext).toEqual([1])
  })

  it('makes one write per source task', async () => {
    const a = await seedDone(board())
    const b = await seedDone(board())
    const writes = watchTaskWrites()
    await board().retireSuggestions([`${a.id}:0`, `${a.id}:1`, `${a.id}:2`, `${b.id}:0`])
    expect(writes.count(a.id)).toBe(1)
    expect(writes.count(b.id)).toBe(1)
    expect(writes.total()).toBe(2)
  })

  it('refuses each bad id with a reason and writes nothing for it', async () => {
    const good = await seedDone(board())
    const other = await seedDone(board(), { projectId: 'someone-elses-project' })
    const open = await seedDone(board(), { stage: 'build', doneAt: null })
    const bad = [
      'nocolon',
      `${good.id}:abc`,
      `${good.id}:-1`,
      `${good.id}:1.5`,
      `${good.id}:`,
      `${other.id}:0`,
      `${open.id}:0`,
      `${good.id}:3`,
      `${good.id}:99`,
      'no-such-task-id:0',
    ]
    const writes = watchTaskWrites()
    const reply = await board().retireSuggestions(bad)
    expect(reply.retired).toEqual([])
    expect(reply.refused.map((r) => r.id).sort()).toEqual([...bad].sort())
    for (const r of reply.refused) expect(r.reason.length).toBeGreaterThan(0)
    expect(writes.total()).toBe(0)
    for (const t of [good, other, open])
      expect((await readStored(board(), t.id)).retiredNext ?? []).toEqual([])
  })

  it('retires the valid ids and refuses the others in one call', async () => {
    const t = await seedDone(board())
    const reply = await board().retireSuggestions([`${t.id}:1`, `${t.id}:7`])
    expect(reply.retired).toEqual([`${t.id}:1`])
    expect(reply.refused.map((r) => r.id)).toEqual([`${t.id}:7`])
    expect((await readStored(board(), t.id)).retiredNext).toEqual([1])
  })
})

describe('swipe-deck 66: updateTask with retire_suggestions', () => {
  it('retires on other finished tasks with no other field, from an unfinished bound task', async () => {
    const done = await seedDone(board())
    const mine = await board().createTask({ title: 'Mine', type: 'chore' })
    await board().updateTask({ task_id: mine.id, retire_suggestions: [`${done.id}:0`] })
    expect((await readStored(board(), done.id)).retiredNext).toEqual([0])
    expect((await readStored(board(), mine.id)).stage).toBe(mine.stage)
  })

  it('retires alongside finishing the bound task', async () => {
    const done = await seedDone(board())
    const mine = await board().createTask({ title: 'Mine', type: 'chore' })
    await board().updateTask({
      task_id: mine.id,
      status: 'done',
      summary: 'x',
      retire_suggestions: [`${done.id}:1`],
    })
    expect((await readStored(board(), done.id)).retiredNext).toEqual([1])
    expect((await readStored(board(), mine.id)).stage).toBe('done')
  })

  it('writes nothing to a refused id', async () => {
    const open = await seedDone(board(), { stage: 'build', doneAt: null })
    const mine = await board().createTask({ title: 'Mine', type: 'chore' })
    await board().updateTask({ task_id: mine.id, retire_suggestions: [`${open.id}:0`, 'junk'] })
    expect((await readStored(board(), open.id)).retiredNext ?? []).toEqual([])
  })
})

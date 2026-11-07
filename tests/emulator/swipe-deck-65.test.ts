// swipe-deck 65 in the Firestore emulator (`npm run test:rules`): Board.openSuggestions lists, for
// a finished task within the 7-day window, its Suggested next lines minus retired indices, with
// ids `<taskId>:<index>`; nothing for unfinished or out-of-window tasks. taskBrief (index.ts) is
// not exported, so "no suggestions field when none are open" is covered through openSuggestions
// returning [] (the brief adds the field only when it is non-empty).
import { describe, expect, it } from 'vitest'
import { useBoard } from '../fixtures/board-briefs-b7-emulator.ts'
import { DAY, LINES, readStored, seedDone } from '../fixtures/retire-suggestions-emulator.ts'

const board = useBoard('retire-65')

describe('swipe-deck 65: openSuggestions', () => {
  it('lists every line of a finished task in the window with <taskId>:<index> ids', async () => {
    const task = await seedDone(board())
    expect(board().openSuggestions(task)).toEqual(
      LINES.map((text, i) => ({ id: `${task.id}:${i}`, text }))
    )
  })

  it('leaves retired indices out and keeps the original positions in the ids', async () => {
    const task = await seedDone(board(), { retiredNext: [0, 2] })
    expect(board().openSuggestions(task)).toEqual([{ id: `${task.id}:1`, text: LINES[1] }])
  })

  it('is empty when every line is retired, or the task has no Suggested next', async () => {
    const all = await seedDone(board(), { retiredNext: [0, 1, 2] })
    const none = await seedDone(board(), { summary: 'Done, nothing more.' })
    expect(board().openSuggestions(all)).toEqual([])
    expect(board().openSuggestions(none)).toEqual([])
  })

  it('is empty for an unfinished task even with a Suggested next list', async () => {
    const task = await seedDone(board(), { stage: 'build', doneAt: null })
    expect(board().openSuggestions(await readStored(board(), task.id))).toEqual([])
  })

  it('is empty for a finished task outside the 7-day window, and open just inside it', async () => {
    const old = await seedDone(board(), { doneAt: Date.now() - 8 * DAY })
    const recent = await seedDone(board(), { doneAt: Date.now() - 6 * DAY })
    expect(board().openSuggestions(old)).toEqual([])
    expect(board().openSuggestions(recent)).toHaveLength(LINES.length)
  })
})

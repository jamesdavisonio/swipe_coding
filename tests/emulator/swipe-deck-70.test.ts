// swipe-deck 70 in the Firestore emulator (`npm run test:rules`): Board.ask with options stores the
// need as keyed options (a, b, ... in order, labels trimmed), without options the need is exactly
// as before, a wrong count or a bad label is refused with nothing written, and the deck turns the
// stored need into a choose card with the first option recommended.
import { describe, expect, it } from 'vitest'
import { buildDeck } from '../../packages/web/src/lib/deck.ts'
import { useBoard } from '../fixtures/board-briefs-b7-emulator.ts'
import { readStored } from '../fixtures/retire-suggestions-emulator.ts'

const board = useBoard('ask-70')

async function newTask() {
  return board().createTask({ title: 'Ask seed', type: 'chore' })
}
async function commentCount(taskId: string) {
  const snap = await board().db.collection('comments').where('taskId', '==', taskId).get()
  return snap.size
}

describe('swipe-deck 70: Board.ask with options', () => {
  it('stores the options keyed a, b, c in order with labels trimmed', async () => {
    const t = await newTask()
    await board().ask(t.id, 'Which way?', ['  Left ', 'Right', '\tStraight on\n'])
    expect((await readStored(board(), t.id)).needs).toEqual({
      kind: 'question',
      question: 'Which way?',
      options: [
        { key: 'a', label: 'Left' },
        { key: 'b', label: 'Right' },
        { key: 'c', label: 'Straight on' },
      ],
    })
  })

  it('accepts the 2 and 6 option limits and a 200 character label', async () => {
    const t = await newTask()
    await board().ask(t.id, 'Two?', ['x'.repeat(200), 'y'])
    expect((await readStored(board(), t.id)).needs?.options).toHaveLength(2)
    await board().ask(t.id, 'Six?', ['1', '2', '3', '4', '5', '6'])
    expect((await readStored(board(), t.id)).needs?.options?.map((o) => o.key)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ])
  })

  it('without options the need is exactly question and text', async () => {
    const t = await newTask()
    await board().ask(t.id, 'Plain?')
    expect((await readStored(board(), t.id)).needs).toEqual({
      kind: 'question',
      question: 'Plain?',
    })
  })

  it.each([
    ['one option', ['only']],
    ['seven options', ['1', '2', '3', '4', '5', '6', '7']],
    ['an empty label', ['ok', '']],
    ['a whitespace label', ['ok', '   ']],
    ['a 201 character label', ['ok', 'x'.repeat(201)]],
  ])('refuses %s and writes nothing', async (_name, options) => {
    const t = await newTask()
    const before = await commentCount(t.id)
    const needsBefore = (await readStored(board(), t.id)).needs ?? null
    await expect(board().ask(t.id, 'Refused?', options)).rejects.toThrow()
    expect((await readStored(board(), t.id)).needs ?? null).toEqual(needsBefore)
    expect(await commentCount(t.id)).toBe(before)
  })

  it('gives the deck a choose card with the first option recommended', async () => {
    const t = await newTask()
    await board().ask(t.id, 'Pick one?', ['First', 'Second', 'Third'])
    const stored = await readStored(board(), t.id)
    const cards = buildDeck({
      tasks: [stored],
      projects: [],
      specBodies: {},
      handledNext: [],
      passed: [],
      now: Date.now(),
    }).filter((c) => c.taskId === t.id)
    expect(cards).toHaveLength(1)
    expect(cards[0].action).toEqual({ type: 'choose' })
    expect(cards[0].choices.map((c) => [c.key, c.label, c.recommended])).toEqual([
      ['a', 'First', true],
      ['b', 'Second', false],
      ['c', 'Third', false],
    ])
  })
})

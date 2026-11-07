// swipe-deck 61 (pure): a Suggested next line `<what> — <why>` splits at the first separator; the
// next card's headline is the cut what, its why the why, its suggestion the whole line.
import { describe, expect, it } from 'vitest'
import { buildDeck, splitSuggestion } from '../packages/web/src/lib/deck.ts'
import { NOW, PROJECTS, makeTask, makeTodo } from './fixtures/web-threads-b2.tsx'

describe('swipe-deck 61: splitSuggestion', () => {
  it.each([
    ['Add dark mode — It is hard to read at night', 'Add dark mode', 'It is hard to read at night'],
    ['  Add dark mode  —  Because  ', 'Add dark mode', 'Because'],
    ['A — B — C', 'A', 'B — C'],
    ['Add dark mode — ', 'Add dark mode', null],
    ['Add dark mode', 'Add dark mode', null],
    ['Add dark-mode (fast) - quickly', 'Add dark-mode (fast) - quickly', null],
  ])('%j', (line, what, why) => {
    expect(splitSuggestion(line)).toEqual({ what, why })
  })
})

describe('swipe-deck 61: next cards', () => {
  const long = 'x'.repeat(70)
  const cards = buildDeck({
    tasks: [
      makeTask('d', {
        stage: 'done',
        doneAt: NOW - 60_000,
        unread: true,
        summary: `Done.\n\n### Suggested next\nAdd dark mode — Night reading hurts\nPlain one\n${long} — why`,
      }),
    ],
    todos: [makeTodo('t1')],
    projects: PROJECTS,
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
  })
  const next = (i: number) => cards.find((c) => c.id === `next:d:${i}`)!

  it('headline is the what, why is the why, suggestion stays whole', () => {
    expect(next(0).headline).toBe('Add dark mode')
    expect(next(0).why).toBe('Night reading hurts')
    expect(next(0).suggestion).toBe('Add dark mode — Night reading hurts')
  })

  it('a line without the separator is all what, with why null', () => {
    expect(next(1).headline).toBe('Plain one')
    expect(next(1).why).toBeNull()
  })

  it('cuts only the what to 59 characters plus an ellipsis', () => {
    expect(next(2).headline).toBe('x'.repeat(59) + '…')
    expect(next(2).why).toBe('why')
  })

  it('why is null on every other card', () => {
    const others = cards.filter((c) => c.kind !== 'next')
    expect(others.length).toBeGreaterThan(0)
    expect(others.every((c) => c.why === null)).toBe(true)
  })
})

// swipe-deck 43: a `Yes:` line directly under the brief heading is the card's headline; without
// it the headline falls back by kind; over 60 characters is cut to 59 plus "…"; briefs without
// the line parse exactly as before (Brief.yes is null).
import { describe, expect, it } from 'vitest'
import { parseBrief } from '../packages/web/src/lib/brief.ts'
import { HEADLINE_MAX, buildDeck, type DeckCard } from '../packages/web/src/lib/deck.ts'
import { MINUTE, NOW, makeTask, makeTodo } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

const deck = (over: Partial<Parameters<typeof buildDeck>[0]> = {}): DeckCard[] =>
  buildDeck({
    tasks: [],
    todos: [],
    projects: [],
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
    ...over,
  })
const headlineOf = (id: string, cards: DeckCard[]) => cards.find((c) => c.id === id)?.headline
const ask = (id: string, stage: 'build' | 'pr', gate: 'fix' | 'round' | 'summary', yes?: string) =>
  makeTask(id, {
    title: 'Title',
    stage,
    needs: { kind: 'question', question: briefText(gate, { yes }) },
    updatedAt: NOW - MINUTE,
  })

describe('swipe-deck 43: brief.yes', () => {
  it('reads the Yes line under the heading, with or without a blank line before it', () => {
    expect(parseBrief(briefText('fix', { yes: 'Fix the lint error' }))?.yes).toBe(
      'Fix the lint error'
    )
    expect(parseBrief(briefText('fix', { yes: 'Go', yesAfterBlank: true }))?.yes).toBe('Go')
  })

  it('is null without the line, and the parts are the same as with it', () => {
    const without = parseBrief(briefText('fix'))
    const withYes = parseBrief(briefText('fix', { yes: 'Go' }))
    expect(without?.yes).toBeNull()
    expect(withYes?.parts).toEqual(without?.parts)
  })

  it('ignores a Yes line that is not directly under the heading', () => {
    const text = briefText('fix').replace('You asked for it.', 'Yes: not this one')
    expect(parseBrief(text)?.yes).toBeNull()
  })
})

describe('swipe-deck 43: headlines', () => {
  it('uses the Yes phrase for briefed cards', () => {
    const cards = deck({
      tasks: [
        ask('f', 'build', 'fix', 'Fix the lint error'),
        ask('c', 'pr', 'fix', 'Fix CI by pinning'),
        ask('r', 'build', 'round', 'Go again'),
        ask('s', 'build', 'summary', 'Ship now'),
        makeTask('sp', { needs: { kind: 'spec' }, updatedAt: NOW - MINUTE }),
      ],
      specBodies: { sp: briefText('spec', { yes: 'Build the search' }) },
    })
    expect(headlineOf('fix:f', cards)).toBe('Fix the lint error')
    expect(headlineOf('ci_failed:c', cards)).toBe('Fix CI by pinning')
    expect(headlineOf('round:r', cards)).toBe('Go again')
    expect(headlineOf('summary_gate:s', cards)).toBe('Ship now')
    expect(headlineOf('spec:sp', cards)).toBe('Build the search')
  })

  it('falls back by kind without a Yes line', () => {
    const cards = deck({
      tasks: [
        makeTask('sp', { title: 'T', needs: { kind: 'spec' }, updatedAt: NOW - MINUTE }),
        ask('f', 'build', 'fix'),
        ask('c', 'pr', 'fix'),
        ask('r', 'build', 'round'),
        ask('s', 'build', 'summary'),
        makeTask('q', { needs: { kind: 'question', question: 'Which colour?' } }),
        makeTask('m', {
          stage: 'pr',
          needs: { kind: 'pr' },
          pr: { number: 24, url: 'https://github.com/x/y/pull/24' },
        }),
        makeTask('a', {
          stage: 'after_deploy',
          needs: { kind: 'after_deploy' },
          afterDeploy: ['One', 'Two'],
          afterDone: [false, false],
        }),
        makeTask('b', {
          stage: 'after_deploy',
          needs: { kind: 'after_deploy' },
          afterDeploy: ['One'],
          afterDone: [false],
        }),
        makeTask('d', {
          title: 'Done one',
          stage: 'done',
          doneAt: NOW - MINUTE,
          unread: true,
          summary: 'Shipped.\n\n### Suggested next\nAdd dark mode',
        }),
      ],
      todos: [makeTodo('t1'), makeTodo('t2'), makeTodo('t3', { projectId: 'p-site' })],
      specBodies: { sp: briefText('spec') },
    })
    expect(headlineOf('spec:sp', cards)).toBe('Start building: T')
    expect(headlineOf('fix:f', cards)).toBe('Fix it: Title')
    expect(headlineOf('ci_failed:c', cards)).toBe('Fix CI: Title')
    expect(headlineOf('round:r', cards)).toBe('Another round: Title')
    expect(headlineOf('summary_gate:s', cards)).toBe('Ship it: Title')
    expect(headlineOf('question:q', cards)).toBe('Which colour?')
    expect(headlineOf('merge:m', cards)).toBe('Merge PR #24 into main')
    expect(headlineOf('after_deploy:a', cards)).toBe('Do the 2 after-deploy steps')
    expect(headlineOf('after_deploy:b', cards)).toBe('Do the 1 after-deploy step')
    expect(headlineOf('todos:p-kanban', cards)).toBe('2 things only you can do')
    expect(headlineOf('todos:p-site', cards)).toBe('1 thing only you can do')
    expect(headlineOf('summary:d', cards)).toBe('Done: Done one')
    expect(headlineOf('next:d:0', cards)).toBe('Add dark mode')
  })

  it('cuts a headline over 60 characters to 59 plus an ellipsis, and keeps 60 whole', () => {
    expect(HEADLINE_MAX).toBe(60)
    const long = 'x'.repeat(61)
    const exact = 'y'.repeat(60)
    const cards = deck({
      tasks: [ask('f', 'build', 'fix', long), ask('r', 'build', 'round', exact)],
    })
    expect(headlineOf('fix:f', cards)).toBe(`${'x'.repeat(59)}…`)
    expect(headlineOf('round:r', cards)).toBe(exact)
  })

  it('cuts a fallback headline too', () => {
    const cards = deck({
      tasks: [makeTask('q', { needs: { kind: 'question', question: 'z'.repeat(90) } })],
    })
    expect(headlineOf('question:q', cards)).toBe(`${'z'.repeat(59)}…`)
  })
})

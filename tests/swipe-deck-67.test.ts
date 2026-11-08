// swipe-deck 67: buildDeck shows no `next` card for an index in the task's retiredNext and keeps
// the others (ids keep their original index). Also: suggestedNext from @kanban/shared parses a
// Suggested next list the way the web's does. Runs with `npm test` (no Firestore).
import { describe, expect, it } from 'vitest'
import * as shared from '../packages/shared/src/index.ts'
import { suggestedNext as webSuggestedNext } from '../packages/web/src/lib/brief.ts'
import { buildDeck } from '../packages/web/src/lib/deck.ts'
import { HOUR, NOW, PROJECTS, makeTask } from './fixtures/web-threads-b2.tsx'

const summary = 'Done.\n\n### Suggested next\n- One\n- Two\n- Three\n\n### Other\nx'
const deck = (retiredNext?: number[]) =>
  buildDeck({
    tasks: [
      makeTask('dn', {
        stage: 'done',
        doneAt: NOW - HOUR,
        unread: false,
        summary,
        ...(retiredNext ? { retiredNext } : {}),
      }),
    ],
    projects: PROJECTS,
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
  }).map((c) => c.id)

const sharedSuggestedNext = (text: string): string[] => {
  const fn = (shared as unknown as { suggestedNext?: (t: string) => string[] }).suggestedNext
  expect(typeof fn, 'suggestedNext is not exported from @kanban/shared').toBe('function')
  return fn!(text)
}

describe('swipe-deck 67: retired suggestions leave the deck', () => {
  it('shows every next card when none is retired', () => {
    expect(deck()).toEqual(['next:dn:0', 'next:dn:1', 'next:dn:2'])
    expect(deck([])).toEqual(['next:dn:0', 'next:dn:1', 'next:dn:2'])
  })

  it('drops a retired index and keeps the others with their original ids', () => {
    expect(deck([1])).toEqual(['next:dn:0', 'next:dn:2'])
  })

  it('drops several, and all', () => {
    expect(deck([0, 2])).toEqual(['next:dn:1'])
    expect(deck([0, 1, 2])).toEqual([])
  })

  it('ignores a retired index past the list', () => {
    expect(deck([9])).toEqual(['next:dn:0', 'next:dn:1', 'next:dn:2'])
  })
})

describe('swipe-deck 67: shared suggestedNext matches the web one', () => {
  it.each([
    summary,
    'No list here.',
    '### Suggested next\n1. A\n* B\n\n  \nC',
    'Top\n\n### Suggested next\nOnly one\n## Next heading\nnot me',
  ])('gives the same lines for %j', (text) => {
    expect(sharedSuggestedNext(text)).toEqual(webSuggestedNext(text))
  })

  it('parses the lines of a list', () => {
    expect(sharedSuggestedNext(summary)).toEqual(['One', 'Two', 'Three'])
  })
})

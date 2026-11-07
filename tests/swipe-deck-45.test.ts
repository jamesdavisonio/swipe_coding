// swipe-deck 45: a question with two or more options offers them as choices (first recommended);
// a brief's closing Reply line offers its phrase as the single action; neither means no action.
import { describe, expect, it } from 'vitest'
import type { TaskNeed } from '../packages/shared/src/index.ts'
import { buildDeck, type DeckCard } from '../packages/web/src/lib/deck.ts'
import { NOW, makeTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

const decide = (tasks: ReturnType<typeof makeTask>[]): DeckCard[] =>
  buildDeck({
    tasks,
    todos: [],
    projects: [],
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
  })
const one = (needs: TaskNeed, stage: 'build' | 'pr' = 'build'): DeckCard =>
  decide([makeTask('t', { stage, needs })])[0]

describe('swipe-deck 45: card actions', () => {
  it('offers the options as choices, the first recommended', () => {
    const card = one({
      kind: 'question',
      question: 'Which?',
      options: [
        { key: 'a', label: 'Plan A' },
        { key: 'b', label: 'Plan B' },
        { key: 'c', label: 'Plan C' },
      ],
    })
    expect(card.action).toEqual({ type: 'choose' })
    expect(card.choices).toEqual([
      { key: 'a', label: 'Plan A', recommended: true },
      { key: 'b', label: 'Plan B', recommended: false },
      { key: 'c', label: 'Plan C', recommended: false },
    ])
  })

  it.each([
    ['fix', 'fix confirmed'],
    ['round', 'another round'],
    ['summary', 'ship it'],
  ] as const)('a %s brief offers its Reply phrase as the single action', (gate, phrase) => {
    const card = one({ kind: 'question', question: briefText(gate, { reply: phrase }) })
    expect(card.action).toEqual({ type: 'phrase', phrase })
    expect(card.choices).toEqual([])
  })

  it('a fix brief on a PR-stage task (CI failed) still offers its phrase', () => {
    const card = one(
      { kind: 'question', question: briefText('fix', { reply: 'fix confirmed' }) },
      'pr'
    )
    expect(card.kind).toBe('ci_failed')
    expect(card.action).toEqual({ type: 'phrase', phrase: 'fix confirmed' })
  })

  it('a plain question with no options has no right-swipe action', () => {
    const card = one({ kind: 'question', question: 'Anything else?' })
    expect(card.action).toBeNull()
    expect(card.choices).toEqual([])
  })

  it('a single option and no Reply line has no action', () => {
    const card = one({ kind: 'question', question: 'Ok?', options: [{ key: 'a', label: 'Only' }] })
    expect(card.action).toBeNull()
    expect(card.choices).toEqual([])
  })

  it('spec and merge cards carry their own action', () => {
    const cards = decide([
      makeTask('s', { needs: { kind: 'spec' } }),
      makeTask('m', {
        stage: 'pr',
        needs: { kind: 'pr' },
        pr: { number: 1, url: 'https://x/pull/1' },
      }),
    ])
    expect(cards.find((c) => c.kind === 'spec')?.action).toEqual({ type: 'approve' })
    expect(cards.find((c) => c.kind === 'merge')?.action).toEqual({ type: 'merge' })
  })
})

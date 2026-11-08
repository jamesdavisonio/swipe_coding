// swipe-deck 42: one card per thing waiting on James, by the task's need, open to-dos per project,
// unread done tasks inside the 7-day window and their unhandled "Suggested next" lines.
import { describe, expect, it } from 'vitest'
import { DONE_VISIBLE_MS } from '../packages/shared/src/index.ts'
import { buildDeck, type DeckCard } from '../packages/web/src/lib/deck.ts'
import { HOUR, MINUTE, NOW, PROJECTS, makeTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

const input = (over: Partial<Parameters<typeof buildDeck>[0]> = {}) => ({
  tasks: [],
  projects: PROJECTS,
  specBodies: {},
  handledNext: [] as string[],
  passed: [] as string[],
  now: NOW,
  ...over,
})
const idsOf = (cards: DeckCard[]) => cards.map((c) => c.id).sort()
const ask = (
  id: string,
  stage: 'build' | 'pr' | 'merged' | 'main_ci',
  gate: 'fix' | 'round' | 'summary'
) => makeTask(id, { stage, needs: { kind: 'question', question: briefText(gate) } })

describe('swipe-deck 42: cards by need', () => {
  it('maps each need to its card kind', () => {
    const cards = buildDeck(
      input({
        tasks: [
          makeTask('sp', { needs: { kind: 'spec' } }),
          ask('fx', 'build', 'fix'),
          ask('rd', 'build', 'round'),
          ask('sg', 'build', 'summary'),
          ask('ci-pr', 'pr', 'fix'),
          ask('ci-merged', 'merged', 'fix'),
          ask('ci-main', 'main_ci', 'fix'),
          makeTask('q', { needs: { kind: 'question', question: 'Which?' } }),
          makeTask('pr', {
            stage: 'pr',
            needs: { kind: 'pr' },
            pr: { number: 24, url: 'https://x/pull/24' },
          }),
          makeTask('ad', {
            stage: 'after_deploy',
            needs: { kind: 'after_deploy' },
            afterDeploy: ['A', 'B'],
            afterDone: [true, false],
          }),
        ],
        specBodies: { sp: briefText('spec') },
      })
    )
    expect(idsOf(cards)).toEqual(
      [
        'spec:sp',
        'fix:fx',
        'round:rd',
        'summary_gate:sg',
        'ci_failed:ci-pr',
        'ci_failed:ci-merged',
        'ci_failed:ci-main',
        'question:q',
        'merge:pr',
        'after_deploy:ad',
      ].sort()
    )
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]))
    expect(byId['merge:pr'].important).toBe(true)
    expect(cards.filter((c) => c.important)).toHaveLength(1)
    expect(byId['after_deploy:ad'].steps).toEqual([
      { label: 'A', done: true },
      { label: 'B', done: false },
    ])
    expect(byId['spec:sp'].taskId).toBe('sp')
    expect(byId['spec:sp'].projectName).toBe('kanban')
  })

  it('a question that is a plain brief of another gate on a build task is a fix card, not CI', () => {
    const [card] = buildDeck(input({ tasks: [ask('x', 'build', 'fix')] }))
    expect(card.kind).toBe('fix')
  })

  it('only a fix brief at pr, merged or main_ci is CI failed: a round brief or plain question is not', () => {
    const cards = buildDeck(
      input({
        tasks: [
          ask('r-pr', 'pr', 'round'),
          ask('s-main', 'main_ci', 'summary'),
          makeTask('q-main', {
            stage: 'main_ci',
            needs: { kind: 'question', question: 'Which?' },
          }),
        ],
      })
    )
    expect(idsOf(cards)).toEqual(['question:q-main', 'round:r-pr', 'summary_gate:s-main'])
  })

  it('uses the project id as the name of an unknown project', () => {
    const [card] = buildDeck(
      input({ projects: [], tasks: [makeTask('s', { needs: { kind: 'spec' } })] })
    )
    expect(card.projectName).toBe('p-kanban')
  })

  it('makes a summary card for a done, unread task inside the 7-day window only', () => {
    const done = (id: string, over: object) =>
      makeTask(id, { stage: 'done', doneAt: NOW - HOUR, unread: true, ...over })
    const cards = buildDeck(
      input({
        tasks: [
          done('fresh', {}),
          done('read', { unread: false }),
          done('old', { doneAt: NOW - DONE_VISIBLE_MS - MINUTE }),
          makeTask('idle', {}),
        ],
      })
    )
    expect(idsOf(cards)).toEqual(['summary:fresh'])
    expect(cards[0].at).toBe(NOW - HOUR)
  })

  it('makes a next card per Suggested next line of a done task in the window, unless handled', () => {
    const summary = 'Shipped.\n\n### Suggested next\n- Add dark mode\n- Add search'
    const tasks = [
      makeTask('d', { stage: 'done', doneAt: NOW - HOUR, unread: false, summary }),
      makeTask('old', { stage: 'done', doneAt: NOW - DONE_VISIBLE_MS - MINUTE, summary }),
    ]
    const all = buildDeck(input({ tasks }))
    expect(idsOf(all)).toEqual(['next:d:0', 'next:d:1'])
    expect(all.find((c) => c.id === 'next:d:1')?.suggestion).toBe('Add search')
    const rest = buildDeck(input({ tasks, handledNext: ['next:d:0'] }))
    expect(idsOf(rest)).toEqual(['next:d:1'])
  })

  it('makes nothing from an empty board', () => {
    expect(buildDeck(input())).toEqual([])
  })
})

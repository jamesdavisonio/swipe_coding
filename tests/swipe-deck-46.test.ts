// swipe-deck 46: deck order by kind, oldest first inside a kind; every next card comes last, after
// every summary; passed cards go last in the order passed and are marked passed; a chosen project goes first.
import { describe, expect, it } from 'vitest'
import { KIND_ORDER, buildDeck, projectFirst } from '../packages/web/src/lib/deck.ts'
import { HOUR, MINUTE, NOW, PROJECTS, makeTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

const pr = { number: 7, url: 'https://x/pull/7' }
const tasks = () => [
  makeTask('sp-new', { needs: { kind: 'spec' }, updatedAt: NOW - MINUTE }),
  makeTask('sp-old', { projectId: 'p-site', needs: { kind: 'spec' }, updatedAt: NOW - 5 * HOUR }),
  makeTask('mg', { stage: 'pr', pr, needs: { kind: 'pr' }, updatedAt: NOW - HOUR }),
  makeTask('ci', {
    stage: 'main_ci',
    needs: { kind: 'question', question: briefText('fix') },
    updatedAt: NOW - 2 * HOUR,
  }),
  makeTask('fx', {
    needs: { kind: 'question', question: briefText('fix') },
    updatedAt: NOW - HOUR,
  }),
  makeTask('rd', {
    needs: { kind: 'question', question: briefText('round') },
    updatedAt: NOW - HOUR,
  }),
  makeTask('sg', {
    needs: { kind: 'question', question: briefText('summary') },
    updatedAt: NOW - HOUR,
  }),
  makeTask('q', {
    projectId: 'p-site',
    needs: { kind: 'question', question: 'Which?' },
    updatedAt: NOW - HOUR,
  }),
  makeTask('ad', {
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: ['A'],
    afterDone: [false],
    updatedAt: NOW - HOUR,
  }),
  makeTask('dn', {
    projectId: 'p-site',
    stage: 'done',
    doneAt: NOW - 3 * MINUTE,
    unread: true,
    summary: 'Done.\n\n### Suggested next\nOne\nTwo',
  }),
  makeTask('dm', {
    stage: 'done',
    doneAt: NOW - 10 * MINUTE,
    unread: true,
    summary: 'Done.\n\n### Suggested next\nThree\nFour',
  }),
]
const build = (over: Partial<Parameters<typeof buildDeck>[0]> = {}) =>
  buildDeck({
    tasks: tasks(),
    projects: PROJECTS,
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
    ...over,
  })
const ids = (cards: { id: string }[]) => cards.map((c) => c.id)

const BASE = [
  'ci_failed:ci',
  'spec:sp-old',
  'spec:sp-new',
  'fix:fx',
  'round:rd',
  'summary_gate:sg',
  'question:q',
  'merge:mg',
  'after_deploy:ad',
  'summary:dm',
  'summary:dn',
  'next:dm:0',
  'next:dm:1',
  'next:dn:0',
  'next:dn:1',
]

describe('swipe-deck 46: order', () => {
  it('exports the kind order', () => {
    expect(KIND_ORDER).toEqual([
      'ci_failed',
      'spec',
      'fix',
      'round',
      'summary_gate',
      'question',
      'merge',
      'after_deploy',
      'summary',
      'next',
    ])
  })

  it('orders by kind, oldest first inside a kind, every next card after every summary', () => {
    expect(ids(build())).toEqual(BASE)
  })

  it('puts passed cards after every other card, in the order passed, marked passed', () => {
    const cards = build({ passed: ['spec:sp-new', 'ci_failed:ci'] })
    expect(ids(cards)).toEqual([
      ...BASE.filter((id) => id !== 'spec:sp-new' && id !== 'ci_failed:ci'),
      'spec:sp-new',
      'ci_failed:ci',
    ])
    expect(cards.filter((c) => c.passed).map((c) => c.id)).toEqual(['spec:sp-new', 'ci_failed:ci'])
  })

  it('marks no card passed by default', () => {
    expect(build().some((c) => c.passed)).toBe(false)
  })
})

describe('swipe-deck 46: projectFirst', () => {
  it('puts the project cards first, keeping the order in both groups', () => {
    const cards = projectFirst(build(), 'p-site')
    expect(ids(cards)).toEqual([
      'spec:sp-old',
      'question:q',
      'summary:dn',
      'next:dn:0',
      'next:dn:1',
      'ci_failed:ci',
      'spec:sp-new',
      'fix:fx',
      'round:rd',
      'summary_gate:sg',
      'merge:mg',
      'after_deploy:ad',
      'summary:dm',
      'next:dm:0',
      'next:dm:1',
    ])
  })

  it('leaves the order alone for a project with no cards', () => {
    expect(ids(projectFirst(build(), 'p-cal'))).toEqual(BASE)
  })
})

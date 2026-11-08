// decision-notifications 78 (pure part): the notice for a question need is titled "<kind label> ·
// <project>" with the deck's headline for that card, where the kind is the one the deck gives
// that question: CI failed, Fix, Another round, Ship it or Question. Every notice is checked
// against the real deck card for the same task.
import { describe, expect, it } from 'vitest'
import { decisionNotice } from '../packages/shared/src/index.ts'
import { KIND_LABEL, buildDeck } from '../packages/web/src/lib/deck.ts'
import { NOW, PROJECTS, makeTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

type Stage = 'build' | 'pr' | 'merged' | 'main_ci'
const asked = (stage: Stage, question: string) =>
  makeTask('q1', {
    title: 'Mend the export',
    stage,
    needs: { kind: 'question', question },
  })
const deckCard = (task: ReturnType<typeof asked>) =>
  buildDeck({
    tasks: [task],
    todos: [],
    projects: PROJECTS,
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
  })[0]

const cases: [string, Stage, string, string, string][] = [
  ['a fix brief', 'build', briefText('fix', { yes: 'Mend the export' }), 'Fix', 'Mend the export'],
  [
    'a fix brief at pr',
    'pr',
    briefText('fix', { yes: 'Fix the lint' }),
    'CI failed',
    'Fix the lint',
  ],
  [
    'a fix brief at merged',
    'merged',
    briefText('fix', { yes: 'Fix main' }),
    'CI failed',
    'Fix main',
  ],
  ['a fix brief at main_ci', 'main_ci', briefText('fix', { yes: 'Fix CI' }), 'CI failed', 'Fix CI'],
  ['a round brief', 'build', briefText('round', { yes: 'Go again' }), 'Another round', 'Go again'],
  ['a summary brief', 'build', briefText('summary', { yes: 'Ship it' }), 'Ship it', 'Ship it'],
  ['a fix brief without Yes:', 'build', briefText('fix'), 'Fix', 'Fix it: Mend the export'],
  ['a CI brief without Yes:', 'pr', briefText('fix'), 'CI failed', 'Fix CI: Mend the export'],
  [
    'a round brief without Yes:',
    'build',
    briefText('round'),
    'Another round',
    'Another round: Mend the export',
  ],
  [
    'a summary brief without Yes:',
    'build',
    briefText('summary'),
    'Ship it',
    'Ship it: Mend the export',
  ],
  ['a plain question', 'build', 'What should we call it?', 'Question', 'What should we call it?'],
  ['an empty question', 'build', '', 'Question', 'Question'],
]

describe('decision-notifications 78: the question notice', () => {
  it.each(cases)('%s', (_name, stage, question, label, body) => {
    const task = asked(stage, question)
    const n = decisionNotice(task, 'kanban')
    expect(n).toMatchObject({
      title: `${label} · kanban`,
      body,
      tag: 'decision:q1',
      url: '/?task=q1',
    })
    const card = deckCard(task)
    expect(n?.body).toBe(card.headline)
    expect(n?.title).toBe(`${KIND_LABEL[card.kind]} · kanban`)
  })

  it('treats a question with options like one without: the question text', () => {
    const task = makeTask('q1', {
      stage: 'build',
      needs: {
        kind: 'question',
        question: 'Which font?',
        options: [
          { key: 'a', label: 'Serif' },
          { key: 'b', label: 'Sans' },
        ],
      },
    })
    expect(decisionNotice(task, 'kanban')).toMatchObject({
      title: 'Question · kanban',
      body: 'Which font?',
    })
  })

  it('cuts a long headline to 60 characters: the first 59 and an ellipsis', () => {
    const n = decisionNotice(asked('build', briefText('fix', { yes: 'w'.repeat(70) })), 'kanban')
    expect(n?.body).toBe(`${'w'.repeat(59)}…`)
    const q = decisionNotice(asked('build', 'v'.repeat(61)), 'kanban')
    expect(q?.body).toBe(`${'v'.repeat(59)}…`)
  })

  it("gives a well-formed brief of another gate the deck's headline", () => {
    const task = asked('build', briefText('spec'))
    expect(decisionNotice(task, 'kanban')?.body).toBe(deckCard(task).headline)
  })
})

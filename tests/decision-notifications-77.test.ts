// decision-notifications 77 (pure part): the notice for a spec need is titled "Spec · <project>",
// its body is the headline the deck shows for that spec card (the brief's Yes: line, else
// "Start building: <task title>", cut to 60 characters the way the card cuts it), and the deck's
// card for the same task says the same thing (one derivation, two readers).
import { describe, expect, it } from 'vitest'
import { decisionNotice } from '../packages/shared/src/index.ts'
import { HEADLINE_MAX, KIND_LABEL, buildDeck } from '../packages/web/src/lib/deck.ts'
import { NOW, PROJECTS, makeTask, specTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

const deckCard = (task: ReturnType<typeof specTask>, body?: string) =>
  buildDeck({
    tasks: [task],
    todos: [],
    projects: PROJECTS,
    specBodies: body === undefined ? {} : { [task.id]: body },
    handledNext: [],
    passed: [],
    now: NOW,
  })[0]

describe('decision-notifications 77: the spec notice', () => {
  it('is "Spec · <project>" with the Yes: line of the brief as its text', () => {
    const task = specTask()
    const n = decisionNotice(
      task,
      'kanban',
      briefText('spec', { yes: 'Start building notifications' })
    )
    expect(n).toMatchObject({
      kind: 'spec',
      title: 'Spec · kanban',
      body: 'Start building notifications',
      tag: `decision:${task.id}`,
      url: `/?task=${task.id}`,
    })
  })

  it.each([
    ['no brief text', undefined],
    ['a brief of another gate', briefText('fix', { yes: 'Mend it' })],
    ['text that is not a brief', 'just some words'],
    ['a spec brief with no Yes: line', briefText('spec')],
  ])('falls back to "Start building: <title>" for %s', (_name, body) => {
    const task = specTask({ title: 'Order the replies' })
    expect(decisionNotice(task, 'kanban', body)?.body).toBe('Start building: Order the replies')
  })

  it('cuts a long text like the card: over 60 characters, the first 59 and an ellipsis', () => {
    const long = 'x'.repeat(80)
    const n = decisionNotice(specTask(), 'kanban', briefText('spec', { yes: long }))
    expect(n?.body).toBe(`${'x'.repeat(59)}…`)
    expect(n?.body).toHaveLength(HEADLINE_MAX)
    const exact = 'y'.repeat(60)
    expect(decisionNotice(specTask(), 'kanban', briefText('spec', { yes: exact }))?.body).toBe(
      exact
    )
  })

  it('cuts a long fallback title the same way', () => {
    const task = specTask({ title: 'T'.repeat(90) })
    const body = decisionNotice(task, 'kanban')?.body
    expect(body).toHaveLength(HEADLINE_MAX)
    expect(body?.endsWith('…')).toBe(true)
  })

  it('encodes the task id in the url', () => {
    const n = decisionNotice(makeTask('a b/c', { needs: { kind: 'spec' } }), 'kanban')
    expect(n?.url).toBe('/?task=a%20b%2Fc')
    expect(n?.tag).toBe('decision:a b/c')
  })

  it.each([
    ['a Yes: line', briefText('spec', { yes: 'Start building notifications' })],
    ['a long Yes: line', briefText('spec', { yes: 'z'.repeat(75) })],
    ['no brief', undefined],
  ])('matches the deck card for the same task (%s)', (_name, body) => {
    const task = specTask({ projectId: 'p-site' })
    const card = deckCard(task, body)
    const n = decisionNotice(task, 'website', body)
    expect(n?.body).toBe(card.headline)
    expect(n?.title).toBe(`${KIND_LABEL[card.kind]} · website`)
  })
})

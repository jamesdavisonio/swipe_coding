// @vitest-environment jsdom
// swipe-deck 49: dragging right past the threshold or ArrowRight does the card's action; the
// stamp names it; dragging left or ArrowLeft passes; a summary springs back; a next card is dropped.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  HOUR,
  actions,
  choiceTask,
  deployTask,
  fixTask,
  installClock,
  logSpy,
  makeTodo,
  mergeTask,
  noActionTask,
  nextTask,
  pageText,
  press,
  renderAt,
  setBoard,
  specTask,
  summaryTask,
  swipe,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const card = () => screen.getByTestId('deck-card')
const shown = () => (card().textContent ?? '').replace(/\s+/g, ' ')
const id = (id: string) => expect.objectContaining({ id })

describe('swipe-deck 49 right does the action', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  const cases: [string, ReturnType<typeof specTask>, () => void][] = [
    [
      'spec approves',
      specTask(),
      () => expect(actions.approveSpec).toHaveBeenCalledWith(id('spec1')),
    ],
    [
      'a fix answers with its phrase',
      fixTask(),
      () =>
        expect(actions.answerQuestion).toHaveBeenCalledWith(
          id('fix1'),
          expect.objectContaining({ label: 'fix confirmed' })
        ),
    ],
    [
      'after_deploy ticks every remaining step',
      deployTask(),
      () => expect(actions.tickRemainingSteps).toHaveBeenCalledWith(id('deploy1')),
    ],
    [
      'a summary marks the task read',
      summaryTask(),
      () => expect(actions.markRead).toHaveBeenCalledWith(id('sum1')),
    ],
    [
      'a next card queues the suggestion in its project',
      nextTask(),
      () =>
        expect(actions.queueSuggestion.mock.calls[0].slice(0, 2)).toEqual([
          'p-kanban',
          'Add dark mode',
        ]),
    ],
  ]
  it.each(cases)('ArrowRight: %s', async (_name, task, check) => {
    setBoard({ tasks: [task] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    await waitFor(check)
  })

  it('dragging right does the same as ArrowRight', async () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    swipe(card(), 300)
    await waitFor(() => expect(actions.approveSpec).toHaveBeenCalledTimes(1))
  })

  it('todos mark every open to-do of that project done', async () => {
    setBoard({
      todos: [makeTodo('a'), makeTodo('b'), makeTodo('other', { projectId: 'p-site' })],
    })
    renderAt('/', <Deck />)
    press('ArrowRight')
    await waitFor(() => expect(actions.markTodosDone).toHaveBeenCalledTimes(1))
    const given = actions.markTodosDone.mock.calls[0][0] as readonly { id: string }[]
    expect(given.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('a failed write is logged like a failed Threads decision and the card stays', async () => {
    actions.approveSpec.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    await waitFor(() => expect(logSpy.error).toHaveBeenCalled())
    const [type, , context] = logSpy.error.mock.calls[0]
    expect(type).toBe('feature_error')
    expect(context).toMatchObject({ request_id: expect.any(String), action: expect.any(String) })
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({ target: 'spec1', request_id: context.request_id })
    )
    expect(shown()).toContain('Start building: Order the replies')
  })

  it('a small drag does nothing', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    swipe(card(), 10)
    expect(actions.approveSpec).not.toHaveBeenCalled()
    expect(card()).toBeTruthy()
  })

  it.each([
    ['spec', specTask(), 'Build it'],
    ['merge', mergeTask(), 'Merge'],
    ['choices', choiceTask(), 'Choose'],
    ['summary', summaryTask(), 'Got it'],
    ['fix', fixTask(), 'Fix confirmed'],
    ['after_deploy', deployTask(), 'All done'],
    ['next', nextTask(), 'Start it'],
    ['no-action question', noActionTask(), 'Use the mic'],
  ])('while dragging right the %s card stamps its action', (_name, task, label) => {
    setBoard({ tasks: [task] })
    renderAt('/', <Deck />)
    swipe(card(), 300, 0, true)
    expect(screen.getByTestId('deck-stamp-yes').textContent).toContain(label)
  })

  it('a right drag on a question with no action springs back and writes nothing', () => {
    setBoard({ tasks: [noActionTask()] })
    renderAt('/', <Deck />)
    swipe(card(), 300)
    press('ArrowRight')
    expect(card().textContent).toContain('What should we call it?')
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled()
  })

  it('while dragging left the stamp says Later', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    swipe(card(), -300, 0, true)
    expect(screen.getByTestId('deck-stamp-later').textContent).toContain('Later')
  })
})

describe('swipe-deck 49 left passes', () => {
  installClock()
  beforeEach(() => localStorage.clear())
  const two = () =>
    setBoard({
      tasks: [
        specTask({ id: 'old', title: 'Older spec', updatedAt: Date.now() - 5 * HOUR }),
        specTask({ id: 'new', title: 'Newer spec' }),
      ],
    })

  it('ArrowLeft and a left drag send the card behind the others, writing nothing', () => {
    two()
    renderAt('/', <Deck />)
    expect(shown()).toContain('Older spec')
    press('ArrowLeft')
    expect(shown()).toContain('Newer spec')
    swipe(card(), -300)
    expect(shown()).toContain('Older spec')
    expect(actions.approveSpec).not.toHaveBeenCalled()
  })

  it('remembers a pass on this phone across a reload', () => {
    two()
    const view = renderAt('/', <Deck />)
    press('ArrowLeft')
    view.unmount()
    renderAt('/', <Deck />)
    expect(shown()).toContain('Newer spec')
  })

  it('a summary cannot be passed: it springs back and stays on top, not passed', () => {
    setBoard({ tasks: [summaryTask(), nextTask()] })
    const view = renderAt('/', <Deck />)
    swipe(card(), -300, 0, true)
    expect(screen.getByTestId('deck-stamp-later').textContent).toContain('Nothing to dismiss')
    swipe(card(), -300, 0)
    press('ArrowLeft')
    expect(shown()).toContain('Done: Order the replies')
    expect(actions.markRead).not.toHaveBeenCalled()
    view.unmount()
    renderAt('/', <Deck />)
    expect(shown()).toContain('Done: Order the replies')
  })

  it('a next card dragged left says Not now', () => {
    setBoard({ tasks: [nextTask()] })
    renderAt('/', <Deck />)
    swipe(card(), -300, 0, true)
    expect(screen.getByTestId('deck-stamp-later').textContent).toContain('Not now')
  })

  it('a next card dragged left is dropped from this phone', () => {
    setBoard({ tasks: [nextTask()] })
    const view = renderAt('/', <Deck />)
    swipe(card(), -300)
    expect(pageText()).toContain('Nothing needs you.')
    expect(actions.queueSuggestion).not.toHaveBeenCalled()
    view.unmount()
    renderAt('/', <Deck />)
    expect(pageText()).toContain('Nothing needs you.')
  })
})

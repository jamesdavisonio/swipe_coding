// @vitest-environment jsdom
// swipe-deck 49: dragging right past the threshold or ArrowRight does the card's action; the
// stamp names it; dragging left or ArrowLeft passes; a summary is dismissed (markRead, stamp "Dismiss");
// a next card opens the skip sheet.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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

  it('open to-dos are no card: nothing to agree to, no write', () => {
    setBoard({
      todos: [makeTodo('a'), makeTodo('b'), makeTodo('other', { projectId: 'p-site' })],
    })
    renderAt('/', <Deck />)
    expect(screen.queryByTestId('deck-card')).toBeNull()
    press('ArrowRight')
    expect(actions.toggleTodo).not.toHaveBeenCalled()
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
    ['merge', mergeTask(), 'I merged it'],
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

  it('while dragging left a summary stamps Dismiss', () => {
    setBoard({ tasks: [summaryTask(), nextTask()] })
    renderAt('/', <Deck />)
    expect(shown()).toContain('Done: Order the replies')
    swipe(card(), -300, 0, true)
    expect(screen.getByTestId('deck-stamp-later').textContent).toContain('Dismiss')
    expect(screen.getByTestId('deck-stamp-later').textContent).not.toContain('Nothing to dismiss')
  })

  it.each([
    ['a left drag', () => swipe(card(), -300)],
    ['ArrowLeft', () => press('ArrowLeft')],
    ['Later', () => fireEvent.click(screen.getByRole('button', { name: 'Later' }))],
  ])(
    '%s on a summary dismisses it like a right drag: markRead once, nothing else',
    async (_n, go) => {
      setBoard({ tasks: [summaryTask(), nextTask()] })
      renderAt('/', <Deck />)
      expect(shown()).toContain('Done: Order the replies')
      go()
      await vi.waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1))
      expect(actions.markRead).toHaveBeenCalledWith(id('sum1'))
      expect(actions.queueSuggestion).not.toHaveBeenCalled()
      expect(actions.approveSpec).not.toHaveBeenCalled()
    }
  )

  it('a right drag on a summary marks it read once, the same call as a left drag', async () => {
    setBoard({ tasks: [summaryTask(), nextTask()] })
    renderAt('/', <Deck />)
    swipe(card(), 300)
    await vi.waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1))
    expect(actions.markRead).toHaveBeenCalledWith(id('sum1'))
  })

  it('a next card dragged left says Skip', () => {
    setBoard({ tasks: [nextTask()] })
    renderAt('/', <Deck />)
    swipe(card(), -300, 0, true)
    expect(screen.getByTestId('deck-stamp-later').textContent).toContain('Skip')
  })

  it('a next card dragged left opens the skip sheet instead of being dropped', () => {
    setBoard({ tasks: [nextTask()] })
    renderAt('/', <Deck />)
    swipe(card(), -300)
    expect(screen.getByRole('dialog', { name: 'Skip this suggestion?' })).toBeTruthy()
    expect(pageText()).not.toContain('Nothing needs you.')
    expect(actions.queueSuggestion).not.toHaveBeenCalled()
  })
})

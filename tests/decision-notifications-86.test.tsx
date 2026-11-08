// @vitest-environment jsdom
// decision-notifications 86: when the task no longer waits on a decision at the tap, the deck
// opens in its usual order with no error.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { buildDeck, taskFirst } from '../packages/web/src/lib/deck.ts'
import {
  NOW,
  PROJECTS,
  choiceTask,
  installClock,
  makeTask,
  renderAt,
  setBoard,
  specTask,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))
vi.mock('firebase/messaging', async () =>
  (await import('./fixtures/decision-notifications.ts')).messagingModule()
)

const topText = () => (screen.getByTestId('deck-card').textContent ?? '').replace(/\s+/g, ' ')
// A task that was answered: building again, nothing waiting.
const answered = () => makeTask('gone1', { title: 'Answered already', stage: 'build', needs: null })

describe('decision-notifications 86 the task no longer waits', () => {
  installClock()
  afterEach(() => vi.restoreAllMocks())

  it('taskFirst for a task without cards leaves the order unchanged', () => {
    const all = buildDeck({
      tasks: [specTask(), choiceTask(), answered()],
      projects: PROJECTS,
      specBodies: {},
      handledNext: [],
      passed: [],
      now: NOW,
    })
    expect(taskFirst(all, 'gone1').map((c) => c.id)).toEqual(all.map((c) => c.id))
    expect(taskFirst(all, 'never-existed').map((c) => c.id)).toEqual(all.map((c) => c.id))
  })

  it.each([
    ['a task that was answered', 'gone1'],
    ['a task that does not exist', 'never-existed'],
  ])('the deck opened for %s shows its usual first card, with no error', (_name, id) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    setBoard({ tasks: [specTask(), choiceTask(), answered()] })
    renderAt(`/?task=${id}`, <Deck />)
    expect(topText()).toContain('Order the replies')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(errors).not.toHaveBeenCalled()
  })

  it('an empty deck with a task parameter shows the empty deck, with no error', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    setBoard({ tasks: [answered()] })
    renderAt('/?task=gone1', <Deck />)
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(errors).not.toHaveBeenCalled()
  })
})

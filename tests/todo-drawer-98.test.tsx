// @vitest-environment jsdom
// todo-drawer 98: open to-dos no longer make a deck card; the deck's count and overview count only
// the other cards.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { buildDeck } from '../packages/web/src/lib/deck.ts'
import {
  NOW,
  PROJECTS,
  installClock,
  makeTodo,
  pageText,
  renderAt,
  specTask,
} from './fixtures/web-threads-b2.tsx'
import { setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const todos = [
  makeTodo('a'),
  makeTodo('b'),
  makeTodo('other', { projectId: 'p-site' }),
  makeTodo('done', { done: true, doneAt: NOW }),
]

describe('todo-drawer 98: no to-do cards', () => {
  installClock()

  it('buildDeck builds no card of kind todos for open to-dos', () => {
    const input = {
      tasks: [specTask()],
      todos,
      projects: PROJECTS,
      specBodies: {},
      handledNext: [],
      passed: [],
      now: NOW,
    }
    const cards = buildDeck(input)
    expect(cards.map((c) => c.id)).toEqual(['spec:spec1'])
    expect(cards.some((c) => String(c.kind) === 'todos' || c.id.startsWith('todos:'))).toBe(false)
  })

  it('the deck count and the overview leave the to-dos out', () => {
    setB5Board({ tasks: [specTask()], todos })
    renderAt('/', <Deck />)
    expect(screen.getByTestId('deck-card').textContent).toContain('Order the replies')
    expect(screen.getByRole('button', { name: 'Overview' }).textContent).toContain('1 left')
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    const text = pageText()
    expect(text).toContain('1 spec')
    expect(text).not.toMatch(/to-do|thing.* only you can do/i)
  })

  it('with only to-dos the deck is empty', () => {
    setB5Board({ todos })
    renderAt('/', <Deck />)
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(screen.getByRole('button', { name: 'Overview' }).textContent).toContain('All clear')
    expect(pageText()).toContain('Nothing needs you.')
  })
})

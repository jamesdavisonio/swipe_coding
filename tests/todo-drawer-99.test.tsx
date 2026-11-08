// @vitest-environment jsdom
// todo-drawer 99: the deck's to-do button, bottom left of the dock, named "To-dos, <n> open" with
// a badge <n> (open to-dos across all projects); with none open no badge, "To-dos, none open".
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  NOW,
  installClock,
  isBefore,
  makeTodo,
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

const done = (id: string, projectId = 'p-kanban') =>
  makeTodo(id, { projectId, done: true, doneAt: NOW })

describe('todo-drawer 99: the to-do button', () => {
  installClock()

  it('is named with the open count across all projects and shows it as a badge', () => {
    setB5Board({
      tasks: [specTask()],
      todos: [
        makeTodo('a'),
        makeTodo('b'),
        makeTodo('c', { projectId: 'p-site' }),
        done('d'),
        done('e', 'p-site'),
      ],
    })
    renderAt('/', <Deck />)
    const button = screen.getByRole('button', { name: 'To-dos, 3 open' })
    expect((button.textContent ?? '').trim()).toBe('3')
  })

  it('sits at the left of the dock, before the Change it button', () => {
    setB5Board({ tasks: [specTask()], todos: [makeTodo('a')] })
    renderAt('/', <Deck />)
    const button = screen.getByRole('button', { name: 'To-dos, 1 open' })
    expect(isBefore(button, screen.getByRole('button', { name: 'Change it' }))).toBe(true)
  })

  it('with none open there is no badge, the name says so, and it still opens the drawer', () => {
    setB5Board({ tasks: [specTask()], todos: [done('d'), done('e', 'p-site')] })
    renderAt('/', <Deck />)
    const button = screen.getByRole('button', { name: 'To-dos, none open' })
    expect((button.textContent ?? '').trim()).toBe('')
    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: 'To-dos' })).toBeTruthy()
  })

  it('with no to-dos at all the button stays', () => {
    setB5Board({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    expect(screen.getByRole('button', { name: 'To-dos, none open' })).toBeTruthy()
  })

  it('stays on an empty deck', () => {
    setB5Board({ todos: [makeTodo('a'), makeTodo('b')] })
    renderAt('/', <Deck />)
    expect(screen.getByRole('button', { name: 'To-dos, 2 open' }).textContent?.trim()).toBe('2')
  })
})

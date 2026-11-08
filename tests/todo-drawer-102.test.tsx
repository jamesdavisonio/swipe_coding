// @vitest-environment jsdom
// todo-drawer 102: inside a section the open to-dos come first (oldest createdAt first), then a
// "Done" divider and the done ones (newest doneAt first), shown as done (checked box); a row's
// full text is its accessible name.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { todoSections } from '../packages/web/src/lib/todo-drawer.ts'
import {
  HOUR,
  NOW,
  installClock,
  isBefore,
  makeTodo,
  renderAt,
} from './fixtures/web-threads-b2.tsx'
import { PROJECTS } from './fixtures/web-threads-b2.tsx'
import { setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const open = (id: string, hoursAgo: number) => makeTodo(id, { createdAt: NOW - hoursAgo * HOUR })
const done = (id: string, doneHoursAgo: number) =>
  makeTodo(id, { createdAt: NOW - 50 * HOUR, done: true, doneAt: NOW - doneHoursAgo * HOUR })
const TODOS = [
  open('o2', 1),
  open('o1', 3),
  done('d2', 3),
  open('o3', 2),
  done('d1', 1),
  done('d3', 2),
]

describe('todo-drawer 102: order inside a section', () => {
  it('todoSections puts open oldest first and done newest first', () => {
    const [section] = todoSections({ todos: TODOS, projects: PROJECTS, tasks: [] })
    expect(section.open.map((r) => r.todo.id)).toEqual(['o1', 'o3', 'o2'])
    expect(section.done.map((r) => r.todo.id)).toEqual(['d1', 'd3', 'd2'])
  })
})

describe('todo-drawer 102: rows in the drawer', () => {
  installClock()
  function openDrawer(todos = TODOS) {
    setB5Board({ todos })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: /^To-dos, / }))
    return screen.getByRole('dialog', { name: 'To-dos' })
  }
  const text = (id: string) => screen.getByRole('button', { name: `Todo ${id}` })

  it('lists open rows oldest first, then the Done divider, then done rows newest first', () => {
    const dialog = openDrawer()
    const divider = within(dialog).getByText('Done')
    const order = ['o1', 'o3', 'o2'].map(text)
    const after = ['d1', 'd3', 'd2'].map(text)
    const sequence = [...order, divider, ...after]
    for (let i = 1; i < sequence.length; i++)
      expect(isBefore(sequence[i - 1], sequence[i]), `item ${i}`).toBe(true)
  })

  it('shows done rows with a checked box and open rows with an unchecked one', () => {
    openDrawer()
    const box = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name })
    const tick = (id: string, name: string) => box(`${name}: Todo ${id}`).checked
    expect(tick('o1', 'Mark done')).toBe(false)
    expect(tick('d1', 'Mark not done')).toBe(true)
  })

  it('has no Done divider when nothing in the section is done', () => {
    const dialog = openDrawer([open('o1', 1)])
    expect(within(dialog).queryByText('Done')).toBeNull()
  })

  it("a long text is the row button's whole accessible name", () => {
    const long = 'Cut the uptime checks to 3 regions and move the paging rota to Monday. '
      .repeat(4)
      .trim()
    openDrawer([makeTodo('long', { body: long })])
    expect(screen.getByRole('button', { name: long })).toBeTruthy()
  })
})

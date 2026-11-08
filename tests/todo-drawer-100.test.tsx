// @vitest-environment jsdom
// todo-drawer 100: the button opens a dialog titled "To-dos" with "<n> to do across <p> projects"
// and a "Close to-dos" button; focus moves in; the close button, the backdrop and Escape close it
// and focus returns to the to-do button.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  NOW,
  installClock,
  makeTodo,
  pageText,
  press,
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

const SEVEN = [
  makeTodo('a1'),
  makeTodo('a2'),
  makeTodo('a3'),
  makeTodo('b1', { projectId: 'p-site' }),
  makeTodo('b2', { projectId: 'p-site' }),
  makeTodo('c1', { projectId: 'p-cal' }),
  makeTodo('c2', { projectId: 'p-cal' }),
  // a project whose only to-do is done is not counted in "across <p> projects"
  makeTodo('d1', { projectId: 'p-extra', done: true, doneAt: NOW }),
]
const PROJECTS = [
  ...['kanban', 'website', 'calendar'].map((name, i) => ({
    id: ['p-kanban', 'p-site', 'p-cal'][i],
    hostname: 'pc',
    cwd: `C:/code/${name}`,
    name,
    createdAt: NOW,
    updatedAt: NOW,
  })),
  {
    id: 'p-extra',
    hostname: 'pc',
    cwd: 'C:/code/extra',
    name: 'extra',
    createdAt: NOW,
    updatedAt: NOW,
  },
]

const toDoButton = (name: string) => screen.getByRole('button', { name, hidden: true })
function openDrawer(todos = SEVEN, name = 'To-dos, 7 open') {
  setB5Board({ tasks: [specTask()], todos, projects: PROJECTS })
  renderAt('/', <Deck />)
  fireEvent.click(toDoButton(name))
  return screen.getByRole('dialog', { name: 'To-dos' })
}

describe('todo-drawer 100: opening and closing the drawer', () => {
  installClock()

  it('opens a dialog titled To-dos with the summary line and a Close to-dos button', () => {
    const dialog = openDrawer()
    expect(dialog.textContent).toContain('7 to do across 3 projects')
    expect(screen.getByRole('button', { name: 'Close to-dos' })).toBeTruthy()
  })

  it('says "1 project" for one project', () => {
    const dialog = openDrawer([makeTodo('a1'), makeTodo('a2')], 'To-dos, 2 open')
    expect(dialog.textContent).toContain('2 to do across 1 project')
    expect(dialog.textContent).not.toContain('1 projects')
  })

  it('moves focus into the dialog', () => {
    const dialog = openDrawer()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it.each([
    [
      'the Close to-dos button',
      () => fireEvent.click(screen.getByRole('button', { name: 'Close to-dos' })),
    ],
    ['a tap on the backdrop', () => fireEvent.click(screen.getByTestId('sheet-backdrop'))],
    ['Escape', () => press('Escape')],
  ])('%s closes it and focus returns to the to-do button', (_name, close) => {
    openDrawer()
    close()
    expect(screen.queryByRole('dialog', { name: 'To-dos' })).toBeNull()
    expect(pageText()).not.toContain('7 to do across 3 projects')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'To-dos, 7 open' }))
  })
})

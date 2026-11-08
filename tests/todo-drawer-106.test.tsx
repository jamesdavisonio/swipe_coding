// @vitest-environment jsdom
// todo-drawer 106: every control in the drawer and dialog is a button or link with an accessible
// name; the sheet and the dialog are modal (aria-modal) and keep keyboard focus inside while open.
// (44px height and the focus ring are CSS and are not observable in jsdom.)
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { NOW, installClock, makeTodo, renderAt } from './fixtures/web-threads-b2.tsx'
import { setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const TODOS = [
  makeTodo('a', { body: 'Water the plants', link: 'https://example.com/x' }),
  makeTodo('b'),
  makeTodo('c', { projectId: 'p-site', done: true, doneAt: NOW }),
]

describe('todo-drawer 106: accessible, modal drawer and dialog', () => {
  installClock()

  function openSheet() {
    setB5Board({ todos: TODOS })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'To-dos, 2 open' }))
    return screen.getByRole('dialog', { name: 'To-dos' })
  }
  const toDoButton = () => screen.getByRole('button', { name: /^To-dos, /, hidden: true })
  // Every control in `root` has an accessible name: filtering by any name drops none.
  function expectNamed(root: HTMLElement) {
    for (const role of ['button', 'link', 'checkbox'] as const) {
      const all = within(root).queryAllByRole(role)
      const named = within(root).queryAllByRole(role, { name: /\S/ })
      expect(named.length, role).toBe(all.length)
    }
  }

  it('the sheet is modal and every control in it is named', () => {
    const sheet = openSheet()
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(within(sheet).getAllByRole('button').length).toBeGreaterThan(2)
    expectNamed(sheet)
  })

  it('the sheet keeps focus inside: focusing the button behind it pulls focus back in', () => {
    const sheet = openSheet()
    toDoButton().focus()
    expect(sheet.contains(document.activeElement)).toBe(true)
  })

  it('the to-do dialog is modal, its controls are named and it keeps focus inside', () => {
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Water the plants' }))
    const toggle = screen.getByRole('button', { name: 'Mark done' })
    const dialog = toggle.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expectNamed(dialog)
    expect(within(dialog).getByRole('link', { name: /\S/ })).toBeTruthy()
    toDoButton().focus()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('every row has a named text button and a named tick control', () => {
    const sheet = openSheet()
    const row = within(sheet).getByRole('button', { name: 'Todo b' })
    expect(row).toBeTruthy()
    expect(within(sheet).getByRole('checkbox', { name: 'Mark done: Todo b' })).toBeTruthy()
  })
})

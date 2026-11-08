// @vitest-environment jsdom
// todo-drawer 104: tapping a row's text opens a dialog above the sheet: "<project> · <time ago>",
// the full text, "From: <task title>" for a task's to-do, a web link (new tab, rel noreferrer), and
// "Mark done" / "Mark not done" that toggles and closes the dialog. Close button, outside tap and
// Escape close only the dialog, the sheet stays, focus returns to the row's text button.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  DAY,
  HOUR,
  NOW,
  installClock,
  makeTask,
  makeTodo,
  press,
  renderAt,
} from './fixtures/web-threads-b2.tsx'
import { b5Actions, setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const FULL = 'Cut the uptime checks to 3 regions before the invoice on Friday'
const TODOS = [
  makeTodo('full', {
    body: FULL,
    link: 'https://console.example.com/checks?x=1',
    sourceTaskId: 'src',
    createdAt: NOW - 3 * DAY,
  }),
  makeTodo('plain', { body: 'Water the plants', createdAt: NOW - HOUR }),
  makeTodo('bad', {
    body: 'Open the thing',
    link: 'javascript:alert(1)',
    createdAt: NOW - 2 * HOUR,
  }),
  makeTodo('fin', {
    body: 'Already done',
    done: true,
    doneAt: NOW - HOUR,
    createdAt: NOW - 5 * HOUR,
  }),
]
const TASKS = [makeTask('src', { title: 'Trim the monitoring bill' })]

describe('todo-drawer 104: the to-do dialog', () => {
  installClock()

  function openSheet(todos = TODOS) {
    setB5Board({ todos, tasks: TASKS })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: /^To-dos, / }))
  }
  const rowButton = (name: string) => screen.getByRole('button', { name })
  // The to-do dialog is the one holding the Mark done / Mark not done button.
  const toggleButton = () => screen.getByRole('button', { name: /^Mark (not )?done$/ })
  const itemDialog = () =>
    toggleButton().closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')!
  const sheet = () => screen.getByRole('dialog', { name: 'To-dos', hidden: true })
  function openItem(name: string) {
    openSheet()
    fireEvent.click(rowButton(name))
    return itemDialog()
  }

  it('shows project and time ago, the full text, and the task it came from', () => {
    const dialog = openItem(FULL)
    const text = (dialog.textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toContain('kanban · 3 d')
    expect(text).toContain(FULL)
    expect(text).toContain('From: Trim the monitoring bill')
    expect(toggleButton().textContent).toBe('Mark done')
  })

  it('shows a to-do under an hour old as minutes', () => {
    openSheet([makeTodo('fresh', { body: 'Just added', createdAt: NOW - 30 * 60_000 })])
    fireEvent.click(rowButton('Just added'))
    expect((itemDialog().textContent ?? '').replace(/\s+/g, ' ')).toContain('kanban · 30 min')
  })

  it('has no From line for a to-do that came from no task', () => {
    const dialog = openItem('Water the plants')
    expect(dialog.textContent).not.toContain('From:')
  })

  it('links a web link in a new tab with rel noreferrer', () => {
    const dialog = openItem(FULL)
    const link = within(dialog).getByRole<HTMLAnchorElement>('link')
    expect(link.getAttribute('href')).toBe('https://console.example.com/checks?x=1')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('shows no link when the to-do has none', () => {
    expect(within(openItem('Water the plants')).queryByRole('link')).toBeNull()
  })

  it('never links a non-web link', () => {
    const dialog = openItem('Open the thing')
    expect(within(dialog).queryByRole('link')).toBeNull()
    expect(dialog.querySelector('a[href^="javascript"]')).toBeNull()
  })

  it('Mark not done toggles a done to-do back and closes the dialog, the sheet stays', () => {
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Already done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark not done' }))
    expect(b5Actions.toggleTodo).toHaveBeenCalledTimes(1)
    expect(b5Actions.toggleTodo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fin', done: true })
    )
    expect(screen.queryByRole('button', { name: /^Mark (not )?done$/ })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'To-dos' })).toBeTruthy()
  })

  it('Mark done toggles the to-do and closes the dialog, the sheet stays', () => {
    openItem('Water the plants')
    fireEvent.click(toggleButton())
    expect(b5Actions.toggleTodo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plain', done: false })
    )
    expect(screen.queryByRole('button', { name: /^Mark (not )?done$/ })).toBeNull()
    expect(sheet()).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'To-dos' })).toBeTruthy()
  })

  it.each([
    [
      'its close button',
      () => fireEvent.click(within(itemDialog()).getByRole('button', { name: /close/i })),
    ],
    [
      'a tap outside it',
      () => {
        const backdrops = screen.getAllByTestId('sheet-backdrop')
        const top = backdrops[backdrops.length - 1]
        fireEvent.pointerDown(top)
        fireEvent.click(top)
      },
    ],
    ['Escape', () => press('Escape')],
  ])('%s closes only the dialog and focus returns to the row text', (_name, close) => {
    openItem('Water the plants')
    close()
    expect(screen.queryByRole('button', { name: /^Mark (not )?done$/ })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'To-dos' })).toBeTruthy()
    expect(document.activeElement).toBe(rowButton('Water the plants'))
  })
})

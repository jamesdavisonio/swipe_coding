// @vitest-environment jsdom
// todo-drawer 103: ticking a row toggles it through toggleTodo; the row moves at once and the
// counts, the badge and the summary line update; a failed write puts the row back and is logged.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  HOUR,
  NOW,
  installClock,
  isBefore,
  logSpy,
  makeTodo,
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

// kanban: open a (oldest), b, and done c; website: open w.
const TODOS = [
  makeTodo('a', { createdAt: NOW - 3 * HOUR }),
  makeTodo('b', { createdAt: NOW - 2 * HOUR }),
  makeTodo('c', { createdAt: NOW - 9 * HOUR, done: true, doneAt: NOW - HOUR }),
  makeTodo('w', { projectId: 'p-site', createdAt: NOW - HOUR }),
]

describe('todo-drawer 103: ticking a to-do', () => {
  installClock()

  function openDrawer() {
    setB5Board({ todos: TODOS })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'To-dos, 3 open' }))
    return screen.getByRole('dialog', { name: 'To-dos' })
  }
  const text = (id: string) => screen.getByRole('button', { name: `Todo ${id}` })
  // The row's tick box: a native checkbox named "Mark done: <text>" (open) or "Mark not done: <text>".
  const tick = (id: string) =>
    screen.getByRole('checkbox', { name: new RegExp(`^Mark (not )?done: Todo ${id}$`) })
  const header = (dialog: HTMLElement) =>
    within(dialog)
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-expanded'))
      .find((b) => /^kanban/.test(b.textContent ?? ''))!
  const headerText = (dialog: HTMLElement) =>
    (header(dialog).textContent ?? '').replace(/\s+/g, ' ')
  const moved = (id: string, name: string) =>
    screen.getByRole<HTMLInputElement>('checkbox', { name: `${name}: Todo ${id}` })
  const divider = (dialog: HTMLElement) => within(dialog).getByText('Done')
  const toDoButton = (name: string) => screen.getByRole('button', { name, hidden: true })

  it('ticking an open to-do writes toggleTodo, moves the row under Done and updates the counts', () => {
    const dialog = openDrawer()
    expect(isBefore(text('a'), divider(dialog))).toBe(true)
    fireEvent.click(tick('a'))
    expect(b5Actions.toggleTodo).toHaveBeenCalledTimes(1)
    expect(b5Actions.toggleTodo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', done: false })
    )
    expect(isBefore(divider(dialog), text('a'))).toBe(true)
    expect(isBefore(text('b'), divider(dialog))).toBe(true)
    expect(dialog.textContent).toContain('2 to do across 2 projects')
    expect(toDoButton('To-dos, 2 open').textContent?.trim()).toBe('2')
    expect(headerText(dialog)).toMatch(/\b1\b.*\b2 done/)
    expect(moved('a', 'Mark not done').checked).toBe(true)
  })

  it('moves the row at once, before the write settles', () => {
    const dialog = openDrawer()
    b5Actions.toggleTodo.mockImplementation(() => new Promise<void>(() => {}))
    fireEvent.click(tick('a'))
    expect(isBefore(divider(dialog), text('a'))).toBe(true)
  })

  it('unticking a done to-do writes toggleTodo and moves the row back among the open ones', () => {
    const dialog = openDrawer()
    expect(headerText(dialog)).toMatch(/\b2\b.*\b1 done/)
    fireEvent.click(tick('c'))
    expect(b5Actions.toggleTodo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c', done: true })
    )
    // Nothing is done in the section now: no Done divider, and c (oldest) leads the open rows.
    expect(within(dialog).queryByText('Done')).toBeNull()
    expect(isBefore(text('c'), text('a'))).toBe(true)
    expect(isBefore(text('a'), text('b'))).toBe(true)
    expect(dialog.textContent).toContain('4 to do across 2 projects')
    expect(toDoButton('To-dos, 4 open').textContent?.trim()).toBe('4')
    expect(headerText(dialog)).toMatch(/\b3\b.*\b0 done/)
    expect(moved('c', 'Mark done').checked).toBe(false)
  })

  it('logs the tap as user_action toggle_todo on the to-do', () => {
    openDrawer()
    fireEvent.click(tick('a'))
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({
        feature: 'web-threads',
        action: 'toggle_todo',
        target: 'a',
        request_id: expect.any(String),
      })
    )
  })

  it('a failed write shows the row where it was and logs the failure', async () => {
    const dialog = openDrawer()
    b5Actions.toggleTodo.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    fireEvent.click(tick('a'))
    await waitFor(() => expect(logSpy.error).toHaveBeenCalled())
    const [type, , context] = logSpy.error.mock.calls[0]
    expect(['api_call_failed', 'feature_error']).toContain(type)
    expect(context).toMatchObject({
      feature: 'web-threads',
      action: 'toggle_todo',
      request_id: expect.any(String),
    })
    const tap = logSpy.event.mock.calls.find(([t]) => t === 'user_action')!
    expect(tap[1]).toMatchObject({ feature: 'web-threads', action: 'toggle_todo', target: 'a' })
    expect(context.request_id).toBe(tap[1].request_id)
    await waitFor(() => expect(isBefore(text('a'), divider(dialog))).toBe(true))
    expect(dialog.textContent).toContain('3 to do across 2 projects')
    expect(toDoButton('To-dos, 3 open').textContent?.trim()).toBe('3')
    expect(headerText(dialog)).toMatch(/\b2\b.*\b1 done/)
    expect(moved('a', 'Mark done').checked).toBe(false)
  })

  it('a failed untick puts the row back under Done', async () => {
    const dialog = openDrawer()
    b5Actions.toggleTodo.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    fireEvent.click(tick('c'))
    await waitFor(() => expect(logSpy.error).toHaveBeenCalled())
    await waitFor(() => expect(isBefore(divider(dialog), text('c'))).toBe(true))
    expect(headerText(dialog)).toMatch(/\b2\b.*\b1 done/)
    expect(moved('c', 'Mark not done').checked).toBe(true)
  })
})

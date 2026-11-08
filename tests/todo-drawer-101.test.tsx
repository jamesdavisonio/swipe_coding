// @vitest-environment jsdom
// todo-drawer 101: one section per project with at least one to-do, named by the project, with its
// open count (when above 0) and "<d> done"; projects with open to-dos first (oldest open first),
// the rest by name; a section with open to-dos starts expanded, one without collapsed; the header
// toggles it (aria-expanded).
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { todoSections, todoSummary } from '../packages/web/src/lib/todo-drawer.ts'
import {
  HOUR,
  NOW,
  installClock,
  makeTask,
  makeTodo,
  renderAt,
} from './fixtures/web-threads-b2.tsx'
import { setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const project = (id: string, name: string) => ({
  id,
  hostname: 'pc',
  cwd: `C:/code/${name}`,
  name,
  createdAt: NOW,
  updatedAt: NOW,
})
// Deliberately not alphabetical; p-none has no to-do and p-unused is never mentioned.
const PROJECTS = [
  project('p-kanban', 'kanban'),
  project('p-site', 'website'),
  project('p-cal', 'calendar'),
  project('p-arch', 'archive'),
  project('p-none', 'nothing'),
]
const done = (id: string, projectId: string, doneAt = NOW) =>
  makeTodo(id, { projectId, done: true, doneAt })

// website holds the oldest open to-do (5h), kanban the next (1h); archive and calendar have only
// done ones (by name: archive, calendar); kanban has two open and one done, website one open.
const TODOS = [
  makeTodo('k1', { projectId: 'p-kanban', createdAt: NOW - HOUR }),
  makeTodo('k2', { projectId: 'p-kanban', createdAt: NOW - 2 * HOUR }),
  done('k3', 'p-kanban'),
  makeTodo('w1', { projectId: 'p-site', createdAt: NOW - 5 * HOUR }),
  done('c1', 'p-cal'),
  done('c2', 'p-cal'),
  done('c3', 'p-cal'),
  done('a1', 'p-arch'),
]

describe('todo-drawer 101: todoSections', () => {
  const input = { todos: TODOS, projects: PROJECTS, tasks: [] }

  it('lists projects with open to-dos first (oldest open first), then the rest by name', () => {
    const sections = todoSections(input)
    expect(sections.map((s) => s.projectName)).toEqual(['website', 'kanban', 'archive', 'calendar'])
    expect(sections.map((s) => s.projectId)).toEqual(['p-site', 'p-kanban', 'p-arch', 'p-cal'])
  })

  it('splits each section into open and done rows and leaves out projects with no to-do', () => {
    const sections = todoSections(input)
    const kanban = sections.find((s) => s.projectId === 'p-kanban')!
    expect(kanban.open.map((r) => r.todo.id)).toEqual(['k2', 'k1'])
    expect(kanban.done.map((r) => r.todo.id)).toEqual(['k3'])
    expect(sections.some((s) => s.projectId === 'p-none')).toBe(false)
  })

  it('carries the title of the task a to-do came from', () => {
    const [section] = todoSections({
      todos: [makeTodo('t', { sourceTaskId: 'src' }), makeTodo('u')],
      projects: PROJECTS,
      tasks: [makeTask('src', { title: 'Cut the uptime checks' })],
    })
    const rows = Object.fromEntries(section.open.map((r) => [r.todo.id, r.taskTitle]))
    expect(rows.t).toBe('Cut the uptime checks')
    expect(rows.u).toBeFalsy()
  })

  it('summarises the open to-dos and the projects that have any', () => {
    expect(todoSummary(todoSections(input))).toEqual({ open: 3, projects: 2 })
    expect(todoSummary(todoSections({ todos: [], projects: PROJECTS, tasks: [] }))).toEqual({
      open: 0,
      projects: 0,
    })
  })
})

describe('todo-drawer 101: the sections in the drawer', () => {
  installClock()
  const headers = () =>
    within(screen.getByRole('dialog', { name: 'To-dos' }))
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-expanded'))
  const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

  function open() {
    setB5Board({ todos: TODOS, projects: PROJECTS })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'To-dos, 3 open' }))
  }

  it('shows one header per project with to-dos, in order, named with their counts', () => {
    open()
    const list = headers()
    expect(list.map((h) => text(h).split(/\s/)[0])).toEqual([
      'website',
      'kanban',
      'archive',
      'calendar',
    ])
    expect(text(list[0])).toMatch(/\b1\b.*0 done/)
    expect(text(list[1])).toMatch(/\b2\b.*1 done/)
    // no open count (and no 0) when nothing is open
    expect(text(list[2])).toMatch(/1 done/)
    expect(text(list[3])).toMatch(/3 done/)
    expect(text(list[2])).not.toMatch(/\b0\b/)
    expect(text(list[3])).not.toMatch(/\b0\b/)
  })

  it('starts sections with open to-dos expanded and the others collapsed', () => {
    open()
    const [site, kanban, archive, calendar] = headers()
    expect(site.getAttribute('aria-expanded')).toBe('true')
    expect(kanban.getAttribute('aria-expanded')).toBe('true')
    expect(archive.getAttribute('aria-expanded')).toBe('false')
    expect(calendar.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Todo k1' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Todo a1' })).toBeNull()
  })

  it('a header toggles its section', () => {
    open()
    fireEvent.click(headers()[2])
    expect(headers()[2].getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Todo a1' })).toBeTruthy()
    fireEvent.click(headers()[0])
    expect(headers()[0].getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Todo w1' })).toBeNull()
  })
})

// @vitest-environment jsdom
// web-threads B2, criterion 8: a project with open For James items gets a pinned
// "For James · <project>" row with the open count and newest time, sorted with the tasks.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { threadRows } from '../packages/web/src/lib/threads.ts'
import {
  DAY,
  HOUR,
  MINUTE,
  NOW,
  installClock,
  makeTask,
  makeTodo,
  renderAt,
  rowText,
  setBoard,
  where,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

type Row = ReturnType<typeof threadRows>[number]
const ids = (rows: Row[]) =>
  rows.map((r) => (r.kind === 'task' ? r.task.id : `for_james:${r.projectId}`))

const older = makeTodo('older', { createdAt: NOW - 3 * DAY })
const newest = makeTodo('newest', { createdAt: NOW - 30 * MINUTE })
const closed = makeTodo('closed', { createdAt: NOW - MINUTE, done: true, doneAt: NOW - MINUTE })
const siteTodo = makeTodo('site', { projectId: 'p-site', createdAt: NOW - 2 * DAY })

describe('B2-8 For James rows from threadRows', () => {
  it('makes one row per project with open todos: newest first, needs him, never unread', () => {
    const rows = threadRows({ tasks: [], todos: [older, newest, closed], filter: 'all', now: NOW })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      kind: 'for_james',
      projectId: 'p-kanban',
      todos: [newest, older],
      at: NOW - 30 * MINUTE,
      needs: true,
      unread: false,
    })
  })

  it('makes no row for a project whose todos are all done', () => {
    expect(threadRows({ tasks: [], todos: [closed], filter: 'all', now: NOW })).toEqual([])
  })

  it('sorts the row among the task rows by its newest todo', () => {
    const tasks = [
      makeTask('needs-1h', { needs: { kind: 'spec' }, updatedAt: NOW - HOUR }),
      makeTask('needs-10m', { needs: { kind: 'spec' }, updatedAt: NOW - 10 * MINUTE }),
      makeTask('quiet-1m', { updatedAt: NOW - MINUTE }),
    ]
    const rows = threadRows({ tasks, todos: [older, newest], filter: 'all', now: NOW })
    expect(ids(rows)).toEqual(['needs-10m', 'for_james:p-kanban', 'needs-1h', 'quiet-1m'])
  })

  it('keeps only the filtered project', () => {
    const tasks = [
      makeTask('kanban-task', { updatedAt: NOW - MINUTE }),
      makeTask('site-task', { projectId: 'p-site', updatedAt: NOW - MINUTE }),
    ]
    const rows = threadRows({ tasks, todos: [newest, siteTodo], filter: 'p-site', now: NOW })
    expect(ids(rows).sort()).toEqual(['for_james:p-site', 'site-task'])
  })
})

describe('B2-8 For James row on Threads', () => {
  installClock()

  it('shows the open count and the newest time for each project', () => {
    setBoard({ todos: [older, newest, closed, siteTodo] })
    renderAt('/', <Threads />)
    const kanban = rowText(screen.getByRole('button', { name: /^For James · kanban/ }))
    expect(kanban).toContain('2 things to do by hand')
    expect(kanban).toMatch(/\b30\s?m/)
    expect(kanban).not.toMatch(/\b3\s?d/)
    const site = rowText(screen.getByRole('button', { name: /^For James · website/ }))
    expect(site).toContain('1 thing to do by hand')
  })

  it("opens the project's For James tab when tapped", async () => {
    setBoard({ todos: [newest] })
    renderAt('/', <Threads />)
    await userEvent.setup().click(screen.getByRole('button', { name: /^For James · kanban/ }))
    expect(where()).toBe('/p/p-kanban?tab=james')
  })
})

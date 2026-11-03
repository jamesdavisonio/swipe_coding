// @vitest-environment jsdom
// web-threads shared criterion 29 on the thread view: a loading status while the task or its
// comments load, an error with Retry (retrying each failed source) when a read is rejected,
// and a "no longer exists" state with a way back for a task id that is not there.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Thread from '../packages/web/src/pages/Thread.tsx'
import {
  NOW,
  board,
  installClock,
  live,
  logSpy,
  makeTask,
  where,
} from './fixtures/web-threads-b2.tsx'
import {
  queryComposer,
  renderThread,
  sessionMsg,
  setThread,
  thread,
  threadText,
} from './fixtures/web-threads-b3.tsx'
import type { Comment, Task } from '../packages/shared/src/index.ts'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const task = makeTask('t1', { title: 'Build the cache', stage: 'build' })
const comments = [sessionMsg('c1', 'info', 'Started on the cache', NOW)]
const DENIED = 'Missing or insufficient permissions.'
const loading = () => screen.queryByRole('status', { name: 'Loading thread' })
const GONE = 'This task no longer exists.'

describe('B3-29 loading', () => {
  installClock()

  it('shows the loading status while the task loads, and nothing else claims an outcome', () => {
    setThread(task, { comments })
    thread.task = live<Task | null>(null, { loading: true })
    renderThread('/t/t1', <Thread />)
    expect(loading()).toBeTruthy()
    expect(threadText()).not.toContain(GONE)
    expect(threadText()).not.toMatch(/Couldn.t load this thread/)
  })

  it('shows the loading status while the comments load', () => {
    setThread(task)
    thread.comments = live<Comment[]>([], { loading: true })
    renderThread('/t/t1', <Thread />)
    expect(loading()).toBeTruthy()
  })

  it('shows no loading status once both have loaded', () => {
    setThread(task, { comments })
    renderThread('/t/t1', <Thread />)
    expect(loading()).toBeNull()
    expect(threadText()).toContain('Started on the cache')
  })
})

describe('B3-29 an empty thread', () => {
  installClock()

  it('shows "No messages yet." and keeps the composer', () => {
    setThread(task, { comments: [] })
    renderThread('/t/t1', <Thread />)
    expect(threadText()).toContain('No messages yet.')
    expect(queryComposer()).toBeTruthy()
  })
})

describe('B3-29 read errors', () => {
  installClock()

  it.each([
    ['the task', ['task']],
    ['the comments', ['comments']],
    ['both', ['task', 'comments']],
  ])(
    'when %s read fails, shows the error and Retry retries only the failed sources',
    async (_name, failed) => {
      setThread(task, { comments })
      if (failed.includes('task')) thread.task = live<Task | null>(null, { error: DENIED })
      if (failed.includes('comments')) thread.comments = live<Comment[]>([], { error: DENIED })
      renderThread('/t/t1', <Thread />)
      expect(threadText()).toMatch(/Couldn.t load this thread/)
      expect(threadText()).not.toContain(GONE)
      await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
      for (const source of ['task', 'comments'] as const)
        expect(thread[source].retry).toHaveBeenCalledTimes(failed.includes(source) ? 1 : 0)
      // Read errors are logged by data.ts, not by the screen.
      expect(logSpy.error).not.toHaveBeenCalled()
    }
  )
})

describe('B3-29 a task that does not exist', () => {
  installClock()

  it('says so and links back to Threads', async () => {
    setThread(null, { taskId: 'gone' })
    renderThread('/t/gone', <Thread />)
    expect(threadText()).toContain(GONE)
    expect(loading()).toBeNull()
    expect(queryComposer()).toBeNull()
    const link = screen.getByRole('link', { name: 'Back to threads' })
    expect(link.getAttribute('href')).toBe('/')
    await userEvent.setup().click(link)
    expect(where()).toBe('/')
  })
})

describe('B3-29 a failed projects or agents read only degrades the header', () => {
  installClock()

  it.each(['projects', 'agents'] as const)(
    'with the %s read failing, the thread still renders without an error state',
    (source) => {
      setThread(task, { comments })
      board[source] = live([], { error: DENIED })
      renderThread('/t/t1', <Thread />)
      expect(threadText()).toContain('Started on the cache')
      expect(queryComposer()).toBeTruthy()
      expect(threadText()).not.toMatch(/Couldn.t load this thread/)
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
      expect(threadText()).not.toContain('session live')
      if (source === 'projects') expect(threadText()).not.toContain('kanban')
    }
  )
})

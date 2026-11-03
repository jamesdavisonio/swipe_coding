// @vitest-environment jsdom
// web-threads B2, shared criterion 29 on Threads: loading state, read error with retry, and
// the empty copy.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  board,
  installClock,
  live,
  makeTask,
  makeTodo,
  pageText,
  renderAt,
  setBoard,
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

const EMPTY = 'No threads for this project.'
const loadingStatus = () => screen.queryByRole('status', { name: 'Loading threads' })

describe('B2-29 Threads states', () => {
  installClock()

  it.each(['tasks', 'todos', 'projects'] as const)(
    'while %s are loading shows the loading status, not the empty copy',
    (source) => {
      setBoard()
      board[source] = live([], { loading: true })
      renderAt('/', <Threads />)
      expect(loadingStatus()).toBeTruthy()
      expect(pageText()).not.toContain(EMPTY)
    }
  )

  it('shows no loading status once everything has loaded', () => {
    setBoard({ tasks: [makeTask('t', { title: 'Build the cache', stage: 'build' })] })
    renderAt('/', <Threads />)
    expect(loadingStatus()).toBeNull()
  })

  it('on a read error shows the error and a Retry that retries each failed source', async () => {
    // Read errors are logged by data.ts, not by the screen, so no read-error logging is asserted.
    setBoard({ todos: [makeTodo('todo')] })
    board.tasks = live([], { error: 'Missing or insufficient permissions.' })
    board.projects = live([], { error: 'Missing or insufficient permissions.' })
    renderAt('/', <Threads />)
    expect(pageText()).toMatch(/Couldn.t load threads/)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(board.tasks.retry).toHaveBeenCalledTimes(1)
    expect(board.projects.retry).toHaveBeenCalledTimes(1)
  })

  it('shows the empty copy when there are no rows at all', () => {
    setBoard()
    renderAt('/', <Threads />)
    expect(pageText()).toContain(EMPTY)
  })

  it('shows the empty copy for a project with no rows while others have some', () => {
    setBoard({ tasks: [makeTask('t', { title: 'Build the cache', stage: 'build' })] })
    renderAt('/?project=p-cal', <Threads />)
    expect(pageText()).toContain(EMPTY)
    expect(pageText()).not.toContain('Build the cache')
  })
})

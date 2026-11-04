// @vitest-environment jsdom
// web-threads B5, shared criterion 29 on Projects, a project and New task: a loading status named
// after the screen while its reads load, an error with a Retry that retries each failed source
// when a read is rejected, and the B5 empty copy for empty lists. Read errors are logged by
// data.ts, not by the screens, so no read-error logging is asserted here.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewTask from '../packages/web/src/pages/NewTask.tsx'
import Project from '../packages/web/src/pages/Project.tsx'
import Projects from '../packages/web/src/pages/Projects.tsx'
import {
  NOW,
  board,
  installClock,
  live,
  logSpy,
  makeTask,
  makeTodo,
} from './fixtures/web-threads-b2.tsx'
import { b5Text, pastWeek, renderB5, setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b5.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const DENIED = 'Missing or insufficient permissions.'
const SOURCES = ['projects', 'tasks', 'todos'] as const
const COULD_NOT_LOAD = /Couldn.t load/

function loadingSource(source: (typeof SOURCES)[number]) {
  board[source] = live([], { loading: true })
}
function failSource(source: (typeof SOURCES)[number]) {
  board[source] = live([], { error: DENIED })
}

const NO_PROJECTS = 'No projects yet. Start a Claude session in a folder to add one.'
const NOTHING_LIVE = 'Nothing live. Queue a task from New task.'
const NOTHING_FOR_JAMES = 'Nothing for you to do by hand.'
const NOTHING_DONE = 'Nothing finished this week.'

const openProjects = () => renderB5('/projects', { '/projects': <Projects /> })
const openProject = (search = '') =>
  renderB5(`/p/p-kanban${search}`, { '/p/:projectId': <Project /> })
const openNewTask = () => renderB5('/new', { '/new': <NewTask /> })

describe('B5-29 Projects', () => {
  installClock()
  const loading = () => screen.queryByRole('status', { name: 'Loading projects' })

  it.each(SOURCES)('while %s are loading shows the loading status, not the empty copy', (s) => {
    setB5Board({ projects: [] })
    loadingSource(s)
    openProjects()
    expect(loading()).toBeTruthy()
    expect(b5Text()).not.toContain(NO_PROJECTS)
  })

  it('shows no loading status once everything has loaded', () => {
    setB5Board()
    openProjects()
    expect(loading()).toBeNull()
  })

  it.each(SOURCES)('when the %s read fails, shows the error and Retry retries it', async (s) => {
    setB5Board()
    failSource(s)
    openProjects()
    expect(b5Text()).toMatch(COULD_NOT_LOAD)
    expect(b5Text()).not.toContain(NO_PROJECTS)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(board[s].retry).toHaveBeenCalled()
    for (const other of SOURCES.filter((o) => o !== s))
      expect(board[other].retry).not.toHaveBeenCalled()
    expect(logSpy.error).not.toHaveBeenCalled()
  })

  it('with no projects shows the empty copy', () => {
    setB5Board({ projects: [] })
    openProjects()
    expect(b5Text()).toContain(NO_PROJECTS)
    expect(loading()).toBeNull()
  })
})

describe('B5-29 a project', () => {
  installClock()
  const loading = () => screen.queryByRole('status', { name: 'Loading project' })

  it.each(SOURCES)('while %s are loading shows the loading status, not the empty copy', (s) => {
    setB5Board()
    loadingSource(s)
    openProject()
    expect(loading()).toBeTruthy()
    expect(b5Text()).not.toContain(NOTHING_LIVE)
  })

  it('shows no loading status once everything has loaded', () => {
    setB5Board()
    openProject()
    expect(loading()).toBeNull()
  })

  it.each(SOURCES)('when the %s read fails, shows the error and Retry retries it', async (s) => {
    setB5Board()
    failSource(s)
    openProject()
    expect(b5Text()).toMatch(COULD_NOT_LOAD)
    expect(b5Text()).not.toContain(NOTHING_LIVE)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(board[s].retry).toHaveBeenCalled()
    for (const other of SOURCES.filter((o) => o !== s))
      expect(board[other].retry).not.toHaveBeenCalled()
    expect(logSpy.error).not.toHaveBeenCalled()
  })

  it('an empty project shows each tab’s empty copy', async () => {
    setB5Board()
    openProject()
    expect(b5Text()).toContain(NOTHING_LIVE)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^For James/ }))
    expect(b5Text()).toContain(NOTHING_FOR_JAMES)
    await user.click(screen.getByRole('button', { name: /^Done/ }))
    expect(b5Text()).toContain(NOTHING_DONE)
  })

  it('other projects’ tasks and todos do not fill this project’s tabs', () => {
    setB5Board({
      tasks: [makeTask('s1', { projectId: 'p-site', title: 'Website work', stage: 'build' })],
      todos: [makeTodo('s-td', { projectId: 'p-site', body: 'Site todo' })],
    })
    openProject()
    expect(b5Text()).toContain(NOTHING_LIVE)
  })

  it('Done says nothing finished this week while older done tasks wait behind Show older', () => {
    setB5Board({
      tasks: [makeTask('k-o', { title: 'Old search', stage: 'done', doneAt: NOW - pastWeek(2) })],
    })
    openProject('?tab=done')
    expect(b5Text()).toContain(NOTHING_DONE)
    expect(b5Text()).not.toContain('Old search')
    expect(screen.getByRole('button', { name: 'Show 1 older' })).toBeTruthy()
  })

  it('a project with only done todos does not say there is nothing for James', () => {
    setB5Board({ todos: [makeTodo('td', { body: 'Renew the domain', done: true, doneAt: NOW })] })
    openProject('?tab=james')
    expect(b5Text()).toContain('Renew the domain')
    expect(b5Text()).not.toContain(NOTHING_FOR_JAMES)
  })
})

describe('B5-29 New task', () => {
  installClock()

  it('shows a loading status while the projects load', () => {
    setB5Board()
    loadingSource('projects')
    openNewTask()
    expect(screen.getByRole('status', { name: /^Loading/ })).toBeTruthy()
  })

  it('shows no loading status once the projects have loaded', () => {
    setB5Board()
    openNewTask()
    expect(screen.queryByRole('status', { name: /^Loading/ })).toBeNull()
  })

  it('when the projects read fails, shows the error and Retry retries it', async () => {
    setB5Board()
    failSource('projects')
    openNewTask()
    expect(b5Text()).toMatch(COULD_NOT_LOAD)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(board.projects.retry).toHaveBeenCalled()
    expect(logSpy.error).not.toHaveBeenCalled()
  })
})

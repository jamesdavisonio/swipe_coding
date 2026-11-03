// @vitest-environment jsdom
// web-threads B2, criterion 12: the bottom nav marks the current screen and the Threads item
// carries the total needs-you count.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from '../packages/web/src/components/BottomNav.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  installClock,
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

const ITEMS = [
  ['Threads', /^Threads/, '/'],
  ['Projects', /^Projects/, '/projects'],
  ['New task', /^New task/, '/new'],
] as const

const nav = () => screen.getByRole('navigation', { name: 'Main' })
const item = (name: RegExp) => within(nav()).getByRole('link', { name })
const renderNav = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  )

// Two needs in kanban, one in website, one open todo: four in all.
const busyBoard = () =>
  setBoard({
    tasks: [
      makeTask('k1', { title: 'Spec the search', needs: { kind: 'spec' } }),
      makeTask('k2', { title: 'Ship the cache', stage: 'pr', needs: { kind: 'pr' } }),
      makeTask('s1', { projectId: 'p-site', title: 'Pick a font', needs: { kind: 'question' } }),
      makeTask('s2', {
        projectId: 'p-site',
        title: 'Fix the header',
        stage: 'fix',
        type: 'bugfix',
      }),
    ],
    todos: [makeTodo('todo-k')],
  })

describe('B2-12 bottom nav', () => {
  installClock()

  it('links Threads to /, Projects to /projects and New task to /new', () => {
    setBoard()
    renderNav('/')
    for (const [, name, href] of ITEMS) expect(item(name).getAttribute('href')).toBe(href)
  })

  it.each([
    ['/', 'Threads'],
    ['/t/t-1', 'Threads'],
    ['/projects', 'Projects'],
    ['/p/p-kanban', 'Projects'],
    ['/p/p-kanban?tab=james', 'Projects'],
    ['/new', 'New task'],
  ])('at %s marks %s as the current page, and only it', (path, current) => {
    setBoard()
    renderNav(path)
    for (const [label, name] of ITEMS) {
      const expected = label === current ? 'page' : null
      expect(item(name).getAttribute('aria-current') === 'page' ? 'page' : null).toBe(expected)
    }
  })

  it('the Threads item carries the total needs-you count across projects', () => {
    busyBoard()
    renderNav('/projects')
    expect(item(/^Threads/).textContent).toMatch(/(^|\D)4(\D|$)/)
  })

  it('the Threads item shows no count when nothing needs him', () => {
    setBoard({ tasks: [makeTask('s2', { title: 'Fix the header', stage: 'fix', type: 'bugfix' })] })
    renderNav('/')
    expect(item(/^Threads/).textContent).not.toMatch(/\d/)
  })

  it('Threads renders the nav with Threads current and the unfiltered total', () => {
    busyBoard()
    renderAt('/?project=p-site', <Threads />)
    expect(item(/^Threads/).getAttribute('aria-current')).toBe('page')
    expect(item(/^Threads/).textContent).toMatch(/(^|\D)4(\D|$)/)
    expect(pageText()).not.toMatch(/(^|\D)4 need you/)
  })
})

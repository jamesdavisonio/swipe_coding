// @vitest-environment jsdom
// web-threads B5, shared criterion 30 on Projects, a project and New task: every control is
// reachable with Tab and has an accessible name; the project's tabs and New task's type buttons
// expose aria-pressed; the bottom nav marks Projects (on /projects and /p/*) or New task (on /new)
// with aria-current; the main actions work from the keyboard alone. (The visible focus ring is
// CSS that jsdom cannot render; it is checked at review.)
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import NewTask from '../packages/web/src/pages/NewTask.tsx'
import Project from '../packages/web/src/pages/Project.tsx'
import Projects from '../packages/web/src/pages/Projects.tsx'
import {
  DAY,
  HOUR,
  NOW,
  installClock,
  makeTask,
  makeTodo,
  where,
} from './fixtures/web-threads-b2.tsx'
import {
  ONLINE,
  agent,
  b5Actions,
  controls,
  pastWeek,
  pressable,
  renderB5,
  setB5Board,
  tab,
} from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b5.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

// Something in every list: live tasks (one with steps), done tasks this week and older, open and
// done todos (one with a link), an online agent.
const fullBoard = () =>
  setB5Board({
    tasks: [
      makeTask('k-a', {
        title: 'Build the cache',
        stage: 'build',
        afterDeploy: ['Open the site'],
      }),
      makeTask('k-b', {
        type: 'bugfix',
        title: 'Fix the header',
        stage: 'pr',
        needs: { kind: 'pr' },
      }),
      makeTask('k-d', { title: 'Ship the nav', stage: 'done', doneAt: NOW - 2 * DAY }),
      makeTask('k-o', { title: 'Old search', stage: 'done', doneAt: NOW - pastWeek(2) }),
      makeTask('s-x', { projectId: 'p-site', title: 'Website work', stage: 'build' }),
    ],
    todos: [
      makeTodo('td-1', { body: 'Rotate the key', link: 'https://console.cloud.google.com' }),
      makeTodo('td-2', { body: 'Check the logs', createdAt: NOW - 2 * HOUR }),
      makeTodo('td-3', { body: 'Renew the domain', done: true, doneAt: NOW - HOUR }),
    ],
    agents: [agent('a-k', 'p-kanban', ONLINE)],
  })

const SCREENS = {
  '/projects': <Projects />,
  '/p/:projectId': <Project />,
  '/new': <NewTask />,
}
const open = (path: string) => {
  renderB5(path, SCREENS)
  return userEvent.setup()
}

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let i = 0; i < 80 && document.activeElement !== target; i++) await user.tab()
  expect(document.activeElement).toBe(target)
}

// Tabs through the page once; every focusable control must have been reached.
async function expectAllReachable(user: UserEvent, atLeast: number) {
  const reached = new Set<Element>()
  for (let i = 0; i < 80; i++) {
    await user.tab()
    const el = document.activeElement
    if (!el || el === document.body || reached.has(el)) break
    reached.add(el)
  }
  const all = controls()
  expect(all.length).toBeGreaterThanOrEqual(atLeast)
  expect(all.filter((el) => !reached.has(el)).map((el) => el.outerHTML)).toEqual([])
}

function expectAllNamed() {
  for (const role of ['button', 'link', 'textbox', 'checkbox', 'combobox'])
    expect(screen.queryAllByRole(role, { name: '' })).toEqual([])
}

function expectNavCurrent(label: string) {
  const nav = screen.getByRole('navigation', { name: 'Main' })
  const current = nav.querySelectorAll('[aria-current="page"]')
  expect(current).toHaveLength(1)
  expect(current[0].textContent).toMatch(new RegExp(`^${label}`))
}

describe('B5-30 Projects', () => {
  installClock()

  it('reaches every control with Tab and names each one', async () => {
    fullBoard()
    const user = open('/projects')
    expectAllNamed()
    // Three project links plus the three nav links.
    await expectAllReachable(user, 6)
  })

  it('marks Projects as the current page in the nav', () => {
    fullBoard()
    open('/projects')
    expectNavCurrent('Projects')
  })

  it('opens a project with the keyboard', async () => {
    fullBoard()
    const user = open('/projects')
    await tabTo(user, screen.getByRole('link', { name: /website/ }))
    await user.keyboard('{Enter}')
    expect(where()).toBe('/p/p-site')
  })
})

describe('B5-30 a project', () => {
  installClock()

  it.each(['live', 'james', 'done'])(
    'on the %s tab reaches every control with Tab and names each one',
    async (name) => {
      fullBoard()
      const user = open(`/p/p-kanban?tab=${name}`)
      expectAllNamed()
      // Back, + Task, three tabs, at least one item, the three nav links.
      await expectAllReachable(user, 9)
    }
  )

  it('exposes aria-pressed on every tab and marks Projects current in the nav', () => {
    fullBoard()
    open('/p/p-kanban')
    const tabs = pressable()
    expect(tabs).toHaveLength(3)
    for (const t of tabs) expect(['true', 'false']).toContain(t.getAttribute('aria-pressed'))
    expect(tabs.filter((t) => t.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expectNavCurrent('Projects')
  })

  it('switches tabs with the keyboard', async () => {
    fullBoard()
    const user = open('/p/p-kanban')
    await tabTo(user, tab('For James'))
    await user.keyboard('{Enter}')
    expect(tab('For James').getAttribute('aria-pressed')).toBe('true')
    expect(where()).toBe('/p/p-kanban?tab=james')
  })

  it('ticks a todo with Space and adds one with the keyboard alone', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=james')
    await tabTo(user, screen.getByRole('checkbox', { name: 'Check the logs' }))
    await user.keyboard(' ')
    expect(b5Actions.toggleTodo).toHaveBeenCalledTimes(1)
    expect(b5Actions.toggleTodo.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 'td-2' }))
    await tabTo(user, screen.getByRole('textbox', { name: 'Add something to do by hand' }))
    await user.keyboard('Sign in to Stripe')
    await tabTo(user, screen.getByRole('button', { name: 'Add' }))
    await user.keyboard('{Enter}')
    expect(b5Actions.addTodo).toHaveBeenCalledTimes(1)
    expect(b5Actions.addTodo.mock.calls[0][0]).toBe('p-kanban')
    expect(b5Actions.addTodo.mock.calls[0][1].trim()).toBe('Sign in to Stripe')
  })

  it('reveals older done tasks with the keyboard', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=done')
    await tabTo(user, screen.getByRole('button', { name: 'Show 1 older' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('link', { name: /Old search/ })).toBeTruthy()
  })

  it('opens a live task with the keyboard', async () => {
    fullBoard()
    const user = open('/p/p-kanban')
    await tabTo(user, screen.getByRole('link', { name: /Build the cache/ }))
    await user.keyboard('{Enter}')
    expect(where()).toBe('/t/k-a')
  })
})

describe('B5-30 New task', () => {
  installClock()

  it('reaches every control with Tab and names each one, steps field included', async () => {
    fullBoard()
    const user = open('/new')
    await user.click(screen.getByRole('checkbox', { name: 'I have steps to do after deploy' }))
    await user.type(screen.getByRole('textbox', { name: /^Title/ }), 'Add search')
    // Start from the top of the page.
    const focused = document.activeElement
    if (focused instanceof HTMLElement) focused.blur()
    expectAllNamed()
    // Project, three types, title, description, steps box and field, Queue task, three nav links.
    await expectAllReachable(user, 12)
  })

  it('exposes aria-pressed on the type buttons and marks New task current in the nav', () => {
    fullBoard()
    open('/new')
    for (const name of ['Feature', 'Bug fix', 'Chore'])
      expect(['true', 'false']).toContain(
        screen.getByRole('button', { name }).getAttribute('aria-pressed')
      )
    expectNavCurrent('New task')
  })

  it('queues a task with the keyboard alone', async () => {
    fullBoard()
    const user = open('/new')
    await tabTo(user, screen.getByRole('button', { name: 'Chore' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Chore' }).getAttribute('aria-pressed')).toBe('true')
    await tabTo(user, screen.getByRole('textbox', { name: /^Title/ }))
    await user.keyboard('Tidy the docs')
    await tabTo(user, screen.getByRole('button', { name: 'Queue task' }))
    await user.keyboard('{Enter}')
    expect(b5Actions.createTask).toHaveBeenCalledTimes(1)
    expect(b5Actions.createTask.mock.calls[0][1]).toEqual(
      expect.objectContaining({ type: 'chore', title: 'Tidy the docs' })
    )
  })
})

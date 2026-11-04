// @vitest-environment jsdom
// web-threads B5, criterion 22: a project. Back to projects, the project's name, host and live
// dot, a "+ Task" link, and the tabs Live / For James / Done (buttons with aria-pressed, the
// choice in the `tab` search param):
//   Live: tasks not done (For James tasks excluded), needing James first, then most recently
//     updated; each a link to its thread with type, stage text, title, stepper and the
//     after-deploy note.
//   For James: the project's todos, open before done, newest first; tick, link out, add.
//   Done: done within 7 days, newest first, with Show/Hide <N> older for the rest.
// What addTodo and toggleTodo store is tested in the emulator
// (tests/emulator/web-threads-b5-22.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Project from '../packages/web/src/pages/Project.tsx'
import {
  DAY,
  HOUR,
  MINUTE,
  NOW,
  installClock,
  makeTask,
  makeTodo,
  where,
} from './fixtures/web-threads-b2.tsx'
import { deniedWrite } from './fixtures/web-threads-b3.tsx'
import { failures, logSpy, userActions } from './fixtures/web-threads-b4.tsx'
import {
  JUST_INSIDE_WEEK,
  JUST_OUTSIDE_WEEK,
  ONLINE,
  agent,
  b5Actions,
  b5Text,
  hrefsTo,
  isDisabled,
  itemOf,
  pastWeek,
  renderB5,
  setB5Board,
  tab,
  tabLabel,
  taskCard,
  textIn,
} from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b5.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const TASKS = [
  makeTask('k-a', {
    title: 'Build the cache',
    stage: 'build',
    afterDeploy: ['Open the site', 'Check the logs'],
    updatedAt: NOW - HOUR,
  }),
  makeTask('k-b', {
    type: 'bugfix',
    title: 'Fix the header',
    stage: 'pr',
    needs: { kind: 'pr' },
    updatedAt: NOW - 5 * HOUR,
  }),
  makeTask('k-c', {
    type: 'chore',
    title: 'Tidy up',
    stage: 'do',
    afterDeploy: ['Clear the cache'],
    updatedAt: NOW - 10 * MINUTE,
  }),
  // The done tasks are seeded against doneAt order, and the older-finished of each pair was
  // updated more recently, so only a doneAt-newest-first sort gives k-d1, k-d2 and k-o1, k-o2.
  makeTask('k-d2', {
    title: 'Add dark mode',
    stage: 'done',
    summary: 'Dark mode follows the system.',
    doneAt: NOW - 3 * DAY,
    updatedAt: NOW - 2 * HOUR,
  }),
  makeTask('k-d1', {
    title: 'Ship the nav',
    stage: 'done',
    summary: 'Nav is live on phones.',
    doneAt: NOW - 2 * DAY,
    updatedAt: NOW - 2 * DAY,
  }),
  makeTask('k-o2', {
    title: 'Older login',
    stage: 'done',
    doneAt: NOW - pastWeek(13),
    updatedAt: NOW - 3 * HOUR,
  }),
  makeTask('k-o1', {
    title: 'Old search',
    stage: 'done',
    doneAt: NOW - pastWeek(2),
    updatedAt: NOW - pastWeek(2),
  }),
  makeTask('k-fj', { type: 'for_james', title: 'For James', stage: 'do' }),
  makeTask('s-x', { projectId: 'p-site', title: 'Website work', stage: 'build' }),
]

const CONSOLE = 'https://console.cloud.google.com/iam'
const TODOS = [
  makeTodo('td-old', { body: 'Check the logs by hand', createdAt: NOW - 3 * HOUR }),
  makeTodo('td-new', { body: 'Rotate the key', link: CONSOLE, createdAt: NOW - HOUR }),
  makeTodo('td-js', { body: 'Click me', link: 'javascript:alert(1)', createdAt: NOW - 2 * HOUR }),
  makeTodo('td-done2', {
    body: 'Old chore',
    done: true,
    createdAt: NOW - 2 * DAY,
    doneAt: NOW - 2 * HOUR,
  }),
  makeTodo('td-done', {
    body: 'Renew the domain',
    link: 'https://example.com/renew',
    done: true,
    createdAt: NOW - DAY,
    doneAt: NOW - HOUR,
  }),
  makeTodo('s-td', { projectId: 'p-site', body: 'Site todo' }),
]

const fullBoard = () =>
  setB5Board({ tasks: TASKS, todos: TODOS, agents: [agent('a-k', 'p-kanban', ONLINE)] })

const open = (path = '/p/p-kanban') => {
  renderB5(path, { '/p/:projectId': <Project />, '/projects': <h1>All projects</h1> })
  return userEvent.setup()
}

const checkbox = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name })
const todoRow = (name: string) => itemOf(checkbox(name), 'input[type="checkbox"]')
const addField = () => screen.getByRole('textbox', { name: 'Add something to do by hand' })
const addButton = () => screen.getByRole('button', { name: 'Add' })

describe('B5-22 the project header', () => {
  installClock()

  it('links back to Projects', async () => {
    fullBoard()
    const user = open()
    const back = screen.getByRole('link', { name: 'Back to projects' })
    expect(back.getAttribute('href')).toBe('/projects')
    await user.click(back)
    expect(where()).toBe('/projects')
  })

  it('is headed by the project name, with "<host> · session live" under it', () => {
    fullBoard()
    open()
    expect(screen.getByRole('heading', { name: 'kanban' })).toBeTruthy()
    expect(b5Text()).toContain('desk-pc · session live')
  })

  it('says "<host> · no session" when no agent of the project is online', () => {
    fullBoard()
    open('/p/p-site')
    expect(screen.getByRole('heading', { name: 'website' })).toBeTruthy()
    expect(b5Text()).toContain('laptop · no session')
    expect(b5Text()).not.toContain('session live')
  })

  it('has a "+ Task" link to New task with the project preselected', () => {
    fullBoard()
    open()
    const add = screen.getByRole('link', { name: /^(\+\s?)?Task$/ })
    expect(add.getAttribute('href')).toBe('/new?project=p-kanban')
  })
})

describe('B5-22 the tabs', () => {
  installClock()

  it('labels the tabs with their counts and presses Live by default', () => {
    fullBoard()
    open()
    expect(tabLabel('Live')).toBe('Live · 3')
    expect(tabLabel('For James')).toBe('For James · 3')
    expect(tabLabel('Done')).toBe('Done · 2')
    expect(tab('Live').getAttribute('aria-pressed')).toBe('true')
    expect(tab('For James').getAttribute('aria-pressed')).toBe('false')
    expect(tab('Done').getAttribute('aria-pressed')).toBe('false')
  })

  it('choosing a tab presses it and sets the tab param', async () => {
    fullBoard()
    const user = open()
    await user.click(tab('For James'))
    expect(where()).toBe('/p/p-kanban?tab=james')
    expect(tab('For James').getAttribute('aria-pressed')).toBe('true')
    expect(tab('Live').getAttribute('aria-pressed')).toBe('false')
    await user.click(tab('Done'))
    expect(where()).toBe('/p/p-kanban?tab=done')
    expect(tab('Done').getAttribute('aria-pressed')).toBe('true')
    await user.click(tab('Live'))
    expect(where()).toMatch(/^\/p\/p-kanban(\?tab=live)?$/)
    expect(tab('Live').getAttribute('aria-pressed')).toBe('true')
  })

  it('opens on the tab the URL names', () => {
    fullBoard()
    open('/p/p-kanban?tab=done')
    expect(tab('Done').getAttribute('aria-pressed')).toBe('true')
    expect(hrefsTo('/t/')).toEqual(['/t/k-d1', '/t/k-d2'])
  })
})

describe('B5-22 Live', () => {
  installClock()

  it('lists the tasks not done, needing James first, then most recently updated', () => {
    fullBoard()
    open()
    expect(hrefsTo('/t/')).toEqual(['/t/k-b', '/t/k-c', '/t/k-a'])
    const text = b5Text()
    for (const gone of ['Ship the nav', 'Old search', 'Website work'])
      expect(text).not.toContain(gone)
  })

  it('shows type, stage text, title and the stepper on each card', () => {
    fullBoard()
    open()
    const cases: [string, string, string, string][] = [
      ['k-a', 'Feature', 'Building', 'Build the cache'],
      ['k-b', 'Bug fix', 'PR ready · needs you', 'Fix the header'],
      ['k-c', 'Chore', 'Doing', 'Tidy up'],
    ]
    for (const [id, type, stage, title] of cases) {
      const card = taskCard(id)
      const text = textIn(card)
      expect(text).toContain(type)
      expect(text).toContain(stage)
      expect(text).toContain(title)
      expect(within(card).getByRole('list', { name: 'Stages' })).toBeTruthy()
    }
  })

  it('notes the after-deploy steps waiting at the end, singular and plural', () => {
    fullBoard()
    open()
    expect(textIn(taskCard('k-a'))).toContain('2 after-deploy steps for you at the end')
    expect(textIn(taskCard('k-c'))).toContain('1 after-deploy step for you at the end')
    expect(textIn(taskCard('k-b'))).not.toContain('after-deploy')
  })

  it('opens the thread when a card is tapped', async () => {
    fullBoard()
    const user = open()
    await user.click(screen.getByRole('link', { name: /Fix the header/ }))
    expect(where()).toBe('/t/k-b')
  })
})

describe('B5-22 For James', () => {
  installClock()

  it("lists the project's todos, open before done, newest first, ticked when done", () => {
    fullBoard()
    open('/p/p-kanban?tab=james')
    const boxes = screen.getAllByRole<HTMLInputElement>('checkbox')
    expect(boxes.map((b) => textIn(itemOf(b, 'input[type="checkbox"]')))).toEqual([
      expect.stringContaining('Rotate the key'),
      expect.stringContaining('Click me'),
      expect.stringContaining('Check the logs by hand'),
      expect.stringContaining('Renew the domain'),
      expect.stringContaining('Old chore'),
    ])
    expect(boxes.map((b) => b.checked)).toEqual([false, false, false, true, true])
    expect(b5Text()).not.toContain('Site todo')
  })

  it('labels each checkbox by its todo', () => {
    fullBoard()
    open('/p/p-kanban?tab=james')
    for (const body of ['Rotate the key', 'Check the logs by hand', 'Renew the domain'])
      expect(checkbox(body)).toBeTruthy()
  })

  it('ticking an open todo calls toggleTodo with it and logs todo_done', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=james')
    await user.click(checkbox('Rotate the key'))
    expect(b5Actions.toggleTodo).toHaveBeenCalledTimes(1)
    expect(b5Actions.toggleTodo.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: 'td-new', done: false })
    )
    expect(userActions('todo_done')).toHaveLength(1)
    expect(userActions('todo_done')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', target: 'td-new' })
    )
  })

  it('unticking a done todo calls toggleTodo with it and logs the untick', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=james')
    await user.click(checkbox('Renew the domain'))
    expect(b5Actions.toggleTodo).toHaveBeenCalledTimes(1)
    expect(b5Actions.toggleTodo.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: 'td-done', done: true })
    )
    const taps = logSpy.event.mock.calls.filter(
      (call) => call[0] === 'user_action' && (call[1] as { target?: string }).target === 'td-done'
    )
    expect(taps).toHaveLength(1)
    expect((taps[0][1] as { action?: string }).action).toBe('todo_undone')
  })

  it('a refused tick logs api_call_failed with the Firestore code', async () => {
    fullBoard()
    b5Actions.toggleTodo.mockImplementation(deniedWrite)
    const user = open('/p/p-kanban?tab=james')
    await user.click(checkbox('Rotate the key'))
    await waitFor(() => expect(failures('todo_done')).toHaveLength(1))
    expect(failures('todo_done')[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
  })

  it('links an open todo out to its http(s) link in a new tab', () => {
    fullBoard()
    open('/p/p-kanban?tab=james')
    const link = within(todoRow('Rotate the key')).getByRole('link', { name: /^Open/ })
    expect(link.getAttribute('href')).toBe(CONSOLE)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('has no Open link for a done todo, a todo without a link, or a non-web link', () => {
    fullBoard()
    open('/p/p-kanban?tab=james')
    for (const body of ['Renew the domain', 'Check the logs by hand', 'Click me'])
      expect(within(todoRow(body)).queryByRole('link', { name: /^Open/ })).toBeNull()
    expect(screen.getAllByRole('link', { name: /^Open/ })).toHaveLength(1)
  })

  it('Add stays disabled until there is text, then calls addTodo with the project', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=james')
    expect(isDisabled(addButton())).toBe(true)
    await user.type(addField(), '   ')
    expect(isDisabled(addButton())).toBe(true)
    await user.type(addField(), 'Sign in to Stripe')
    expect(isDisabled(addButton())).toBe(false)
    await user.click(addButton())
    expect(b5Actions.addTodo).toHaveBeenCalledTimes(1)
    const [projectId, text] = b5Actions.addTodo.mock.calls[0]
    expect(projectId).toBe('p-kanban')
    expect(text.trim()).toBe('Sign in to Stripe')
    expect(userActions('todo_add')).toHaveLength(1)
    expect(userActions('todo_add')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', target: 'p-kanban' })
    )
  })

  it('a refused add logs api_call_failed with the Firestore code', async () => {
    fullBoard()
    b5Actions.addTodo.mockImplementation(deniedWrite)
    const user = open('/p/p-kanban?tab=james')
    await user.type(addField(), 'Sign in to Stripe')
    await user.click(addButton())
    await waitFor(() => expect(failures('todo_add')).toHaveLength(1))
    expect(failures('todo_add')[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
  })
})

describe('B5-22 Done', () => {
  installClock()

  it('lists the tasks done within 7 days, newest first, with title, summary and when', () => {
    fullBoard()
    open('/p/p-kanban?tab=done')
    expect(hrefsTo('/t/')).toEqual(['/t/k-d1', '/t/k-d2'])
    const first = textIn(taskCard('k-d1'))
    expect(first).toContain('Ship the nav')
    expect(first).toContain('Nav is live on phones.')
    expect(first).toContain('done 2 d')
    const second = textIn(taskCard('k-d2'))
    expect(second).toContain('Add dark mode')
    expect(second).toContain('Dark mode follows the system.')
    expect(second).toContain('done 3 d')
    expect(b5Text()).not.toContain('Old search')
  })

  it('Show <N> older reveals the rest below, newest first, and becomes Hide <N> older', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=done')
    await user.click(screen.getByRole('button', { name: 'Show 2 older' }))
    expect(hrefsTo('/t/')).toEqual(['/t/k-d1', '/t/k-d2', '/t/k-o1', '/t/k-o2'])
    expect(b5Text()).toContain('Old search')
    await user.click(screen.getByRole('button', { name: 'Hide 2 older' }))
    expect(hrefsTo('/t/')).toEqual(['/t/k-d1', '/t/k-d2'])
    expect(screen.getByRole('button', { name: 'Show 2 older' })).toBeTruthy()
  })

  it('has no Show older button when nothing older exists', () => {
    setB5Board({ tasks: TASKS.filter((t) => !t.id.startsWith('k-o')) })
    open('/p/p-kanban?tab=done')
    expect(screen.queryByRole('button', { name: /older/ })).toBeNull()
  })

  // These two tests carry the Done ordering proof. Each bucket has three tasks whose received
  // order, its reverse, updatedAt (either way), id (either way) and title (either way) all differ
  // from the doneAt-newest-first order, so only sorting by doneAt passes.
  it('sorts this week by doneAt, newest first, whatever order the tasks arrive in', () => {
    setB5Board({
      tasks: [
        makeTask('w-a', {
          title: 'Clean the logs',
          stage: 'done',
          doneAt: NOW - 3 * DAY,
          updatedAt: NOW - 2 * HOUR,
        }),
        makeTask('w-c', {
          title: 'Bump the deps',
          stage: 'done',
          doneAt: NOW - 2 * DAY,
          updatedAt: NOW - 2 * DAY,
        }),
        makeTask('w-b', {
          title: 'Add dark mode',
          stage: 'done',
          doneAt: NOW - 4 * DAY,
          updatedAt: NOW - 3 * DAY,
        }),
      ],
    })
    open('/p/p-kanban?tab=done')
    expect(hrefsTo('/t/')).toEqual(['/t/w-c', '/t/w-a', '/t/w-b'])
  })

  it('sorts the older ones by doneAt, newest first, whatever order they arrive in', async () => {
    setB5Board({
      tasks: [
        makeTask('o-a', {
          title: 'Cache warmup',
          stage: 'done',
          doneAt: NOW - pastWeek(3),
          updatedAt: NOW - 2 * HOUR,
        }),
        makeTask('o-c', {
          title: 'Backfill the index',
          stage: 'done',
          doneAt: NOW - pastWeek(1),
          updatedAt: NOW - pastWeek(1),
        }),
        makeTask('o-b', {
          title: 'Archive search',
          stage: 'done',
          doneAt: NOW - pastWeek(5),
          updatedAt: NOW - pastWeek(5),
        }),
      ],
    })
    const user = open('/p/p-kanban?tab=done')
    await user.click(screen.getByRole('button', { name: 'Show 3 older' }))
    expect(hrefsTo('/t/')).toEqual(['/t/o-c', '/t/o-a', '/t/o-b'])
  })

  it('lists a task done just inside DONE_VISIBLE_MS and keeps one just outside behind Show older', async () => {
    setB5Board({
      tasks: [
        makeTask('k-out', { title: 'Just out', stage: 'done', doneAt: NOW - JUST_OUTSIDE_WEEK }),
        makeTask('k-in', { title: 'Just in', stage: 'done', doneAt: NOW - JUST_INSIDE_WEEK }),
      ],
    })
    const user = open('/p/p-kanban?tab=done')
    expect(tabLabel('Done')).toBe('Done · 1')
    expect(hrefsTo('/t/')).toEqual(['/t/k-in'])
    expect(b5Text()).not.toContain('Just out')
    await user.click(screen.getByRole('button', { name: 'Show 1 older' }))
    expect(hrefsTo('/t/')).toEqual(['/t/k-in', '/t/k-out'])
  })

  it('opens the thread of a done task', async () => {
    fullBoard()
    const user = open('/p/p-kanban?tab=done')
    await user.click(screen.getByRole('link', { name: /Add dark mode/ }))
    expect(where()).toBe('/t/k-d2')
  })
})

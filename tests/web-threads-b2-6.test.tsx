// @vitest-environment jsdom
// web-threads B2, criterion 6: Threads orders rows needs-you first, then unread, then most
// recently updated; "Needs you" precedes "Quiet"; the header badge counts what needs James.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { Stage, Task } from '../packages/shared/src/index.ts'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { needsCount, stageText, threadRows } from '../packages/web/src/lib/threads.ts'
import {
  HOUR,
  MINUTE,
  NOW,
  installClock,
  isBefore,
  makeTask,
  makeTodo,
  openButton,
  pageText,
  renderAt,
  rowText,
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

type Row = ReturnType<typeof threadRows>[number]
const ids = (rows: Row[]) =>
  rows.map((r) => (r.kind === 'task' ? r.task.id : `for_james:${r.projectId}`))

describe('B2-6 threadRows order', () => {
  it('puts needs first, then unread, then most recently updated, across projects', () => {
    const tasks = [
      makeTask('quiet-new', { updatedAt: NOW - MINUTE }),
      makeTask('unread', { projectId: 'p-site', unread: true, updatedAt: NOW - 3 * HOUR }),
      makeTask('needs-old', { needs: { kind: 'spec' }, updatedAt: NOW - 5 * HOUR }),
      makeTask('needs-new', {
        projectId: 'p-cal',
        stage: 'build',
        needs: { kind: 'question', question: 'Which?', options: [] },
        updatedAt: NOW - 2 * HOUR,
      }),
      makeTask('quiet-old', { projectId: 'p-site', updatedAt: NOW - 10 * MINUTE }),
    ]
    const rows = threadRows({ tasks, todos: [], filter: 'all', now: NOW })
    expect(ids(rows)).toEqual(['needs-new', 'needs-old', 'unread', 'quiet-new', 'quiet-old'])
  })

  it('among rows that need him, an unread one comes before a newer read one', () => {
    const tasks = [
      makeTask('needs-read', { needs: { kind: 'spec' }, updatedAt: NOW - MINUTE }),
      makeTask('needs-unread', { needs: { kind: 'spec' }, unread: true, updatedAt: NOW - HOUR }),
    ]
    const rows = threadRows({ tasks, todos: [], filter: 'all', now: NOW })
    expect(ids(rows)).toEqual(['needs-unread', 'needs-read'])
  })

  it('describes a task row by its task, updatedAt, need and unread flag', () => {
    const task = makeTask('t', { needs: { kind: 'spec' }, unread: true, updatedAt: NOW - HOUR })
    const [row] = threadRows({ tasks: [task], todos: [], filter: 'all', now: NOW })
    expect(row).toMatchObject({ kind: 'task', task, at: NOW - HOUR, needs: true, unread: true })
  })

  it('leaves out tasks of type for_james', () => {
    const tasks = [makeTask('fj', { type: 'for_james' }), makeTask('feature')]
    expect(ids(threadRows({ tasks, todos: [], filter: 'all', now: NOW }))).toEqual(['feature'])
  })
})

describe('B2-6 needsCount', () => {
  const tasks = [
    makeTask('a', { needs: { kind: 'spec' } }),
    makeTask('b', { projectId: 'p-site', stage: 'pr', needs: { kind: 'pr' } }),
    makeTask('c', { projectId: 'p-site' }),
    makeTask('fj', { type: 'for_james', needs: { kind: 'question' } }),
  ]
  const todos = [
    makeTodo('open-1'),
    makeTodo('open-2', { projectId: 'p-site' }),
    makeTodo('closed', { done: true, doneAt: NOW - HOUR }),
  ]

  it('counts tasks with a need plus open todos across every project', () => {
    expect(needsCount({ tasks, todos, now: NOW })).toBe(4)
    expect(needsCount({ tasks, todos, projectId: 'all', now: NOW })).toBe(4)
  })

  it('counts one project only when given its id', () => {
    expect(needsCount({ tasks, todos, projectId: 'p-site', now: NOW })).toBe(2)
    expect(needsCount({ tasks, todos, projectId: 'p-cal', now: NOW })).toBe(0)
  })
})

describe('B2-6 stageText', () => {
  const at = (stage: string, over: Partial<Task> = {}) =>
    stageText(makeTask('s', { stage: stage as Stage, ...over }))

  it.each([
    ['spec', 'Writing spec'],
    ['approved', 'Approved'],
    ['build', 'Building'],
    ['fix', 'Fixing'],
    ['do', 'Doing'],
    ['pr', 'PR open'],
    ['merged', 'Merged'],
    ['main_ci', 'Waiting for CI on main'],
    ['after_deploy', 'After deploy'],
    ['done', 'Done'],
  ])('stage %s without a need reads "%s"', (stage, text) => {
    expect(at(stage)).toBe(text)
  })

  it.each([
    ['spec', 'spec', 'Spec · needs you'],
    ['question', 'build', 'Question for you'],
    ['pr', 'pr', 'PR ready · needs you'],
    ['after_deploy', 'after_deploy', 'After deploy · needs you'],
  ] as const)('a %s need reads "%s"', (kind, stage, text) => {
    expect(at(stage, { needs: { kind } })).toBe(text)
  })

  it('a stage outside the stage model reads "Unknown stage" instead of crashing', () => {
    expect(at('archived')).toBe('Unknown stage')
  })
})

describe('B2-6 Threads screen', () => {
  installClock()

  // kanban: spec need, quiet build; website: question need, pr need, unread pr; one kanban todo.
  const board = () =>
    setBoard({
      tasks: [
        makeTask('A', {
          title: 'Spec the search',
          needs: { kind: 'spec' },
          updatedAt: NOW - 2 * HOUR,
        }),
        makeTask('B', { title: 'Build the cache', stage: 'build', updatedAt: NOW - 10 * MINUTE }),
        makeTask('C', {
          projectId: 'p-site',
          title: 'Pick a font',
          stage: 'build',
          needs: { kind: 'question', question: 'Which font?', options: [] },
          updatedAt: NOW - 30 * MINUTE,
        }),
        makeTask('D', {
          projectId: 'p-site',
          title: 'Ship the footer',
          stage: 'pr',
          needs: { kind: 'pr' },
          pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
          updatedAt: NOW - 3 * HOUR,
        }),
        makeTask('E', {
          projectId: 'p-site',
          title: 'Fix the header',
          stage: 'pr',
          unread: true,
          updatedAt: NOW - 5 * HOUR,
        }),
      ],
      todos: [makeTodo('todo-1', { createdAt: NOW - HOUR })],
    })

  it('shows the Threads heading and how many things need him across all projects', () => {
    board()
    renderAt('/', <Threads />)
    expect(screen.getByRole('heading', { name: /^Threads/ })).toBeTruthy()
    expect(pageText()).toMatch(/(^|\D)4 need you/)
    expect(pageText()).not.toContain('Nothing needs you')
  })

  it('counts only the filtered project in the header', () => {
    board()
    renderAt('/?project=p-site', <Threads />)
    expect(pageText()).toMatch(/(^|\D)2 need you/)
  })

  it('says "Nothing needs you" when nothing does', () => {
    setBoard({ tasks: [makeTask('B', { title: 'Build the cache', stage: 'build' })] })
    renderAt('/', <Threads />)
    expect(pageText()).toContain('Nothing needs you')
    expect(pageText()).not.toMatch(/\d need you/)
  })

  it('lists "Needs you" rows in order, then "Quiet" rows in order', () => {
    board()
    renderAt('/', <Threads />)
    const sequence = [
      screen.getByRole('heading', { name: /^Needs you/ }),
      openButton('Pick a font'),
      screen.getByRole('button', { name: /^For James · kanban/ }),
      openButton('Spec the search'),
      openButton('Ship the footer'),
      screen.getByRole('heading', { name: /^Quiet/ }),
      openButton('Fix the header'),
      openButton('Build the cache'),
    ]
    sequence.slice(1).forEach((el, i) => expect(isBefore(sequence[i], el)).toBe(true))
  })

  it('omits "Needs you" when nothing needs him', () => {
    setBoard({ tasks: [makeTask('B', { title: 'Build the cache', stage: 'build' })] })
    renderAt('/', <Threads />)
    expect(screen.queryByRole('heading', { name: /^Needs you/ })).toBeNull()
    expect(screen.getByRole('heading', { name: /^Quiet/ })).toBeTruthy()
  })

  it('omits "Quiet" when every row needs him', () => {
    setBoard({ tasks: [makeTask('A', { title: 'Spec the search', needs: { kind: 'spec' } })] })
    renderAt('/', <Threads />)
    expect(screen.getByRole('heading', { name: /^Needs you/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /^Quiet/ })).toBeNull()
  })

  it('gives each task row a meta line of project name and stage text', () => {
    board()
    renderAt('/', <Threads />)
    expect(rowText(openButton('Build the cache'))).toContain('kanban · Building')
    expect(rowText(openButton('Pick a font'))).toContain('website · Question for you')
    expect(rowText(openButton('Fix the header'))).toContain('website · PR open')
  })
})

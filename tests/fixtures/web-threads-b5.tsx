// Shared fixture for the web-threads B5 suites (Projects, a project, New task). Builds on the B2,
// B3 and B4 fixtures: same task and todo builders, board, thread sources, action spies and logger
// spy. Adds the B5 data.ts names (useProject, useProjectTasks, useProjectTodos, createTask,
// toggleTodo, addTodo), projects with distinct hosts, agents, and a router that mounts the
// screens under test on their own routes. The suite passes the screens in: this module is loaded
// by the data.ts mock, so it must not import the app.
//
// The project-scoped hooks are views of the same sources as the board-wide ones (a project's
// tasks are board.tasks for that project, its todos the open and done todos given to setB5Board),
// sharing their loading, error and retry. So a screen reads consistent data whichever of the
// contract's hooks it uses, and a test that fails one source fails it everywhere.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B5)).dataModule())
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  AGENT_STALE_MS,
  DONE_VISIBLE_MS,
  type AgentDoc,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '../../packages/shared/src/index.ts'
import { DAY, MINUTE, NOW, board, live, setBoard, type LiveStub } from './web-threads-b2.tsx'
import { dataModule as b4DataModule } from './web-threads-b4.tsx'

// ---- projects and agents ------------------------------------------------------------------

const project = (id: string, name: string, hostname: string): Project => ({
  id,
  hostname,
  cwd: `C:/code/${name}`,
  name,
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
})

// In the order useProjects returns them (most recently updated first), deliberately not
// alphabetical. Ids match the B2 builders' defaults (makeTask / makeTodo use p-kanban).
export const B5_PROJECTS: Project[] = [
  project('p-kanban', 'kanban', 'desk-pc'),
  project('p-site', 'website', 'laptop'),
  project('p-cal', 'calendar', 'studio-mac'),
]

// An agent of `projectId` whose last heartbeat was `ago` ms before NOW (online while `ago` is
// under AGENT_STALE_MS).
export const agent = (id: string, projectId: string, ago: number): AgentDoc => ({
  id,
  projectId,
  hostname: 'desk-pc',
  cwd: `C:/code/${projectId}`,
  pid: 1234,
  claudeSessionId: null,
  startedAt: NOW - DAY,
  lastSeen: NOW - ago,
})
// Heartbeat ages derived from the shared window, so they hold whatever AGENT_STALE_MS is: well
// inside it, and just past it.
export const ONLINE = Math.floor(AGENT_STALE_MS / 3)
export const STALE = AGENT_STALE_MS + 1_000

// doneAt ages around the "this week" window (DONE_VISIBLE_MS): just inside it, just outside it,
// and `days` past it.
export const JUST_INSIDE_WEEK = DONE_VISIBLE_MS - MINUTE
export const JUST_OUTSIDE_WEEK = DONE_VISIBLE_MS + MINUTE
export const pastWeek = (days: number) => DONE_VISIBLE_MS + days * DAY

// ---- mocked data.ts (B2 + B3 + B4 + the B5 names) -------------------------------------------

export interface NewTaskInput {
  type: TaskType
  title: string
  description: string
  afterDeploy: string[]
}

export const NEW_TASK_ID = 't-new'
const created = (_projectId: string, _input: NewTaskInput) => Promise.resolve(NEW_TASK_ID)
const resolved = () => Promise.resolve()

export const b5Actions = {
  createTask: vi.fn(created),
  toggleTodo: vi.fn((_todo: Todo) => Promise.resolve()),
  addTodo: vi.fn((_projectId: string, _body: string) => Promise.resolve()),
}

// A save that never settles (offline, or a slow network).
export const pendingCreate = () => new Promise<string>(() => {})

// Every todo, open and done (useOpenTodos gets the open ones through board.todos).
let allTodos: Todo[] = []

// Loads the board (everything loaded, no errors) and resets every spy; the B5 writes go back
// to succeeding (createTask resolves with NEW_TASK_ID).
export function setB5Board(
  next: { tasks?: Task[]; todos?: Todo[]; projects?: Project[]; agents?: AgentDoc[] } = {}
) {
  const todos = next.todos ?? []
  setBoard({
    tasks: next.tasks ?? [],
    todos: todos.filter((t) => !t.done),
    projects: next.projects ?? B5_PROJECTS,
  })
  board.agents = live(next.agents ?? [])
  allTodos = todos
  b5Actions.createTask.mockReset()
  b5Actions.createTask.mockImplementation(created)
  b5Actions.toggleTodo.mockReset()
  b5Actions.toggleTodo.mockImplementation(resolved)
  b5Actions.addTodo.mockReset()
  b5Actions.addTodo.mockImplementation(resolved)
}

// A project-scoped view of a board source: same loading, error and retry; the data narrowed.
// Memoised per source and id so a screen sees stable values across renders, as with the real
// hooks (which keep their snapshot in state).
const views = new WeakMap<object, Map<string, LiveStub<unknown>>>()
function view<T>(source: LiveStub<unknown>, id: string, data: () => T): LiveStub<T> {
  let byId = views.get(source)
  if (!byId) {
    byId = new Map()
    views.set(source, byId)
  }
  if (!byId.has(id))
    byId.set(id, {
      data: data(),
      loading: source.loading,
      error: source.error,
      retry: source.retry,
    })
  return byId.get(id) as LiveStub<T>
}

export const dataModule = () => ({
  ...b4DataModule(),
  useProject: (id: string | undefined): LiveStub<Project | null> =>
    view(board.projects, id ?? '', () => board.projects.data.find((p) => p.id === id) ?? null),
  useProjectTasks: (id: string | undefined): LiveStub<Task[]> =>
    view(board.tasks, id ?? '', () => board.tasks.data.filter((t) => t.projectId === id)),
  useProjectTodos: (id: string | undefined): LiveStub<Todo[]> =>
    view(board.todos, id ?? '', () => allTodos.filter((t) => t.projectId === id)),
  ...b5Actions,
})

// ---- rendering ------------------------------------------------------------------------------

function WhereAmI() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

// Mounts each element on its route path (e.g. { '/projects': <Projects /> }); `/` defaults to a
// Threads placeholder and any other path to "elsewhere". The probe prints the URL (read it with
// the B2 fixture's `where`).
export function renderB5(path: string, routes: Record<string, ReactNode>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {Object.entries(routes).map(([at, element]) => (
          <Route key={at} path={at} element={element} />
        ))}
        {'/' in routes ? null : <Route path="/" element={<h1>Threads home</h1>} />}
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <WhereAmI />
    </MemoryRouter>
  )
}

// ---- reading the screen ---------------------------------------------------------------------

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// An element's text as a reader gets it: its text nodes joined by a space (textContent would glue
// neighbours, "2" + "live" → "2live"), skipping form fields' contents and the location probe.
export function textIn(root: Node): string {
  const parts: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('textarea, select, [data-testid="location"]')) continue
    parts.push(node.textContent ?? '')
  }
  return norm(parts.join(' '))
}
export const b5Text = () => textIn(document.body)

// True when `text` contains `phrase` as a whole count ("2 live" but not "12 live").
export const hasPhrase = (text: string, phrase: string) =>
  new RegExp(`(^|[^\\w])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w])`).test(text)

// The item around `el`: its largest ancestor that holds no other element matching `selector`
// (so a card's link, a todo's checkbox, ...). Needs at least two such elements on screen.
export function itemOf(el: HTMLElement, selector: string): HTMLElement {
  let item = el
  while (item.parentElement && item.parentElement.querySelectorAll(selector).length === 1)
    item = item.parentElement
  return item
}

export const linksTo = (prefix: string) =>
  screen
    .queryAllByRole('link')
    .filter((a) => (a.getAttribute('href') ?? '').startsWith(prefix)) as HTMLAnchorElement[]
export const hrefsTo = (prefix: string) => linksTo(prefix).map((a) => a.getAttribute('href'))

// A project's card on Projects (its link to /p/<id>) and the card's text.
export function projectCard(id: string): HTMLElement {
  const link = linksTo(`/p/${id}`)
  if (link.length !== 1) throw new Error(`expected one link to /p/${id}, saw ${link.length}`)
  return itemOf(link[0], 'a[href^="/p/"]')
}
export const projectCardText = (id: string) => textIn(projectCard(id))

// A task's card on a project's Live or Done tab (its link to /t/<id>).
export function taskCard(id: string): HTMLElement {
  const link = linksTo(`/t/${id}`)
  if (link.length !== 1) throw new Error(`expected one link to /t/${id}, saw ${link.length}`)
  return itemOf(link[0], 'a[href^="/t/"]')
}

// The project's tabs and the New task type buttons: the buttons that expose aria-pressed.
export const pressable = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
export function tab(label: string): HTMLElement {
  const found = pressable().find((b) => textIn(b).startsWith(label))
  if (!found) throw new Error(`no tab starting with "${label}"`)
  return found
}
export const tabLabel = (label: string) => textIn(tab(label))

// Every focusable control on the page (the B2/B3 keyboard suites' definition).
export const controls = () =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]'
    )
  ).filter((el) => el.getAttribute('tabindex') !== '-1')

export const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled

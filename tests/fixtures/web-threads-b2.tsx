// Shared fixture for the web-threads B2 suites: builders over the real shared task model, the
// mocked Firestore boundary (data.ts hooks + action spies), the logger spy, a DecisionSheet
// stand-in that shows what opened, and a router that prints where the app navigated to.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(FIXTURE)).dataModule())
import type { ReactNode } from 'react'
import { afterEach, beforeEach, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  initialTaskFields,
  type AgentDoc,
  type Comment,
  type Project,
  type Task,
  type Todo,
} from '../../packages/shared/src/index.ts'

export const NOW = Date.UTC(2026, 10, 3, 12, 0, 0)
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const project = (id: string, name: string): Project => ({
  id,
  hostname: 'pc',
  cwd: `C:/code/${name}`,
  name,
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
})
export const PROJECTS: Project[] = [
  project('p-kanban', 'kanban'),
  project('p-site', 'website'),
  project('p-cal', 'calendar'),
]

// A complete task from the shared initial shape; overrides win.
export function makeTask(id: string, over: Partial<Task> = {}): Task {
  const base = initialTaskFields({
    projectId: over.projectId ?? 'p-kanban',
    type: over.type ?? 'feature',
    title: over.title ?? `Task ${id}`,
    description: '',
    createdBy: 'james',
    afterDeploy: over.afterDeploy ?? [],
    now: NOW - DAY,
  })
  return { ...base, id, ...over }
}

export function makeTodo(id: string, over: Partial<Todo> = {}): Todo {
  return {
    id,
    projectId: 'p-kanban',
    body: `Todo ${id}`,
    link: null,
    done: false,
    sourceTaskId: null,
    createdAt: NOW - HOUR,
    doneAt: null,
    ...over,
  }
}

// ---- mocked data.ts ---------------------------------------------------------------

export interface LiveStub<T> {
  data: T
  loading: boolean
  error: string | null
  retry: Mock<() => void>
}
export function live<T>(data: T, over: Partial<LiveStub<T>> = {}): LiveStub<T> {
  return { data, loading: false, error: null, retry: vi.fn<() => void>(), ...over }
}

export const board = {
  tasks: live<Task[]>([]),
  todos: live<Todo[]>([]),
  // Every to-do, done or not (useAllTodos); setBoard fills it with the to-dos it is given.
  allTodos: live<Todo[]>([]),
  projects: live<Project[]>(PROJECTS),
  agents: live<AgentDoc[]>([]),
}

// Comments per task for the deck (stable objects between renders, like a live snapshot).
const taskComments = new Map<string, LiveStub<Comment[]>>()
const NO_COMMENTS = live<Comment[]>([])
const commentsFor = (id?: string) => (id && taskComments.get(id)) || NO_COMMENTS
export const setComments = (taskId: string, list: Comment[]) =>
  void taskComments.set(taskId, live(list))
// A session comment holding `body` (e.g. a spec brief) for a task.
export const sessionComment = (taskId: string, body: string): Comment => ({
  id: `c-${taskId}`,
  taskId,
  projectId: 'p-kanban',
  agentId: 'agent-1',
  author: 'agent',
  kind: 'info',
  body,
  createdAt: NOW - HOUR,
  deliveredAt: null,
  workingAt: null,
  handledAt: null,
})

export const actions = {
  approveSpec: vi.fn((_task: Task) => Promise.resolve()),
  answerQuestion: vi.fn((_task: Task, _option: { key: string; label: string }) =>
    Promise.resolve()
  ),
  markMerged: vi.fn((_task: Task) => Promise.resolve()),
  markRead: vi.fn((_task: Task) => Promise.resolve()),
  // swipe-deck writes
  sendNote: vi.fn((_task: Task, _text: string) => Promise.resolve()),
  tickRemainingSteps: vi.fn((_task: Task) => Promise.resolve()),
  toggleTodo: vi.fn((_todo: Todo) => Promise.resolve()),
  queueSuggestion: vi.fn((_projectId: string, _suggestion: string, _note?: string) =>
    Promise.resolve('new-task')
  ),
  // decision-notifications device records
  saveDevice: vi.fn((_deviceId: string, _token: string) => Promise.resolve()),
  removeDevice: vi.fn((_deviceId: string) => Promise.resolve()),
}

export const logSpy = {
  event: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  critical: vi.fn(),
}

// Replaces the board (loaded, no errors) and clears every spy.
export function setBoard(
  next: { tasks?: Task[]; todos?: Todo[]; projects?: Project[]; agents?: AgentDoc[] } = {}
) {
  board.tasks = live(next.tasks ?? [])
  board.todos = live(next.todos ?? [])
  board.allTodos = live(next.todos ?? [])
  board.projects = live(next.projects ?? PROJECTS)
  board.agents = live<AgentDoc[]>(next.agents ?? [])
  taskComments.clear()
  vi.clearAllMocks()
}

export const dataModule = () => ({
  useAllTasks: () => board.tasks,
  useOpenTodos: () => board.todos,
  useAllTodos: () => board.allTodos,
  useProjects: () => board.projects,
  useAgents: () => board.agents,
  useTaskComments: (id?: string) => commentsFor(id),
  ...actions,
})
export const logModule = () => ({ log: logSpy })

export function DecisionSheetStandIn(props: {
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}) {
  return (
    <div role="dialog" aria-label="Decision sheet">
      <p>{`sheet ${props.mode}: ${props.task.title}`}</p>
      <button type="button" onClick={props.onClose}>
        Close sheet
      </button>
    </div>
  )
}
export const sheetModule = () => ({ default: DecisionSheetStandIn })

// ---- rendering --------------------------------------------------------------------

// Fakes only the clock (components read Date.now()) and unmounts after each test.
export function installClock() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })
}

function WhereAmI() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

// Mounts `home` on `/`; every other path renders a placeholder. The probe prints the URL.
export function renderAt(path: string, home: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={home} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <WhereAmI />
    </MemoryRouter>
  )
}

export const where = () => screen.getByTestId('location').textContent
export const pageText = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')
export const named = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

// A task row's open control: the button whose name contains the title.
export const openButton = (title: string) => screen.getByRole('button', { name: named(title) })
export const queryOpenButton = (title: string) =>
  screen.queryByRole('button', { name: named(title) })

// The row around a control: its list item (or article), else the control's parent.
export function rowOf(control: HTMLElement): HTMLElement {
  return (
    control.closest<HTMLElement>('li, [role="listitem"], article') ??
    control.parentElement ??
    control
  )
}
export const rowText = (control: HTMLElement) =>
  (rowOf(control).textContent ?? '').replace(/\s+/g, ' ')

// Filter chips are the buttons that expose aria-pressed.
export const chips = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
export function chip(name: string): HTMLElement {
  const found = chips().find((b) => (b.textContent ?? '').trim().startsWith(name))
  if (!found) throw new Error(`no filter chip starting with "${name}"`)
  return found
}

export const isBefore = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

// ---- swipe deck ---------------------------------------------------------------------

export function makeAgent(id: string, over: Partial<AgentDoc> = {}): AgentDoc {
  return {
    id,
    projectId: 'p-kanban',
    hostname: 'pc',
    cwd: 'C:/code/kanban',
    pid: 1,
    claudeSessionId: null,
    startedAt: NOW - DAY,
    lastSeen: NOW - MINUTE,
    ...over,
  }
}

// A pointer event jsdom can carry coordinates on (it has no PointerEvent).
export function pointer(el: Element, type: string, x = 0, y = 0) {
  const proto = Element.prototype as unknown as Record<string, unknown>
  for (const name of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'])
    proto[name] ??= () => false
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperties(e, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
  })
  fireEvent(el, e)
}
// Drags `el` by (dx, dy) in small steps and lets go; `hold` keeps the finger down.
export function swipe(el: Element, dx: number, dy = 0, hold = false) {
  pointer(el, 'pointerdown', 200, 300)
  for (let i = 1; i <= 6; i++) pointer(el, 'pointermove', 200 + (dx * i) / 6, 300 + (dy * i) / 6)
  if (!hold) pointer(el, 'pointerup', 200 + dx, 300 + dy)
}
export const press = (key: string) => fireEvent.keyDown(document.body, { key })

const DECK_PART_TEXT = {
  origin: 'You asked for this on 4 November after the export came back empty.',
  why: 'The export skips every row when one row has a blank date.',
  changes:
    'Rows with a blank date export with the date left empty. For example, the 4 November export keeps row 12.',
  assumptions: 'An empty date is fine for the people who open the file.',
  out: 'Finding out why some rows have no date.',
  agreeing: 'This touches how data is written to the shared drive.',
}
export const DECK_PARTS = DECK_PART_TEXT
export const DECK_EXAMPLE = 'The 4 November export keeps row 12.'
export const fixBriefText = (yes?: string, gate = 'fix') =>
  [
    `## Decision brief (${gate})`,
    ...(yes ? ['', `Yes: ${yes}`] : []),
    '',
    ...[
      ['Where it came from', DECK_PART_TEXT.origin],
      ['Why it exists', DECK_PART_TEXT.why],
      ['What will change', DECK_PART_TEXT.changes],
      ['Key assumptions', DECK_PART_TEXT.assumptions],
      ['Out of scope', DECK_PART_TEXT.out],
      ["What you're agreeing to", DECK_PART_TEXT.agreeing],
    ].flatMap(([h, t]) => [`### ${h}`, t, '']),
    gate === 'spec'
      ? 'Reply "spec confirmed", or tell me what to change.'
      : 'Reply "fix confirmed", or tell me what to change.',
  ].join('\n')

// One task per card kind, each the only thing waiting in its own project unless overridden.
export const specTask = (over: Partial<Task> = {}) =>
  makeTask('spec1', {
    title: 'Order the replies',
    stage: 'spec',
    needs: { kind: 'spec' },
    updatedAt: NOW - HOUR,
    ...over,
  })
export const fixTask = (over: Partial<Task> = {}) =>
  makeTask('fix1', {
    title: 'Mend the export',
    stage: 'build',
    needs: { kind: 'question', question: fixBriefText('Mend the export'), options: [] },
    updatedAt: NOW - HOUR,
    ...over,
  })
export const choiceTask = (over: Partial<Task> = {}) =>
  makeTask('choice1', {
    title: 'Pick a font',
    stage: 'build',
    needs: {
      kind: 'question',
      question: 'Which font?',
      options: [
        { key: 'a', label: 'Serif' },
        { key: 'b', label: 'Sans' },
      ],
    },
    updatedAt: NOW - HOUR,
    ...over,
  })
export const mergeTask = (over: Partial<Task> = {}) =>
  makeTask('merge1', {
    title: 'Ship the footer',
    stage: 'pr',
    needs: { kind: 'pr' },
    pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
    updatedAt: NOW - HOUR,
    ...over,
  })
export const deployTask = (over: Partial<Task> = {}) =>
  makeTask('deploy1', {
    title: 'Roll out search',
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: ['Check the site', 'Rotate the key'],
    updatedAt: NOW - HOUR,
    ...over,
  })
export const summaryTask = (over: Partial<Task> = {}) =>
  makeTask('sum1', {
    title: 'Order the replies',
    stage: 'done',
    unread: true,
    doneAt: NOW - HOUR,
    updatedAt: NOW - HOUR,
    summary: 'Replies now show in the order they were sent.',
    ...over,
  })
export const nextTask = (over: Partial<Task> = {}) =>
  summaryTask({
    id: 'next1',
    title: 'Dark mode groundwork',
    unread: false,
    summary: 'Done.\n\n### Suggested next\nAdd dark mode',
    ...over,
  })
export const noActionTask = (over: Partial<Task> = {}) =>
  makeTask('plain1', {
    title: 'Name the thing',
    stage: 'build',
    needs: { kind: 'question', question: 'What should we call it?', options: [] },
    updatedAt: NOW - HOUR,
    ...over,
  })
export const KIND_LABEL_TEXT = {
  merge: 'Merge',
  spec: 'Spec',
  fix: 'Fix',
  after_deploy: 'After deploy',
  summary: 'Done',
  next: 'Suggested next',
} as const

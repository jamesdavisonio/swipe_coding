// Shared fixture for the web-threads B3 suites (the thread view). Builds on the B2 fixture: same
// task builder, board, action spies and logger spy. Adds comment builders, the thread's live
// sources (task + comments, which can push a new snapshot while the screen is mounted), the
// B3 data.ts names, a HistorySheet stand-in, and a router that mounts the thread on /t/:taskId.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B3)).dataModule())
import { useSyncExternalStore, type ReactNode } from 'react'
import { vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { AgentDoc, Comment, CommentKind, Task } from '../../packages/shared/src/index.ts'
import {
  NOW,
  actions,
  board,
  dataModule as b2DataModule,
  isBefore,
  live,
  setBoard,
  type LiveStub,
} from './web-threads-b2.tsx'

export const TASK_ID = 't1'

// ---- comments ---------------------------------------------------------------------

const comment = (id: string, over: Partial<Comment>): Comment => ({
  id,
  taskId: TASK_ID,
  projectId: 'p-kanban',
  agentId: 'agent-1',
  author: 'agent',
  kind: 'info',
  body: `Comment ${id}`,
  createdAt: NOW,
  deliveredAt: null,
  workingAt: null,
  handledAt: null,
  ...over,
})

// A session message of `kind` (any string, so an unknown kind can be fed in).
export const sessionMsg = (id: string, kind: string, body: string, at: number) =>
  comment(id, { author: 'agent', kind: kind as CommentKind, body, createdAt: at })

// One of James's messages; delivery stamps via `over`.
export const jamesMsg = (id: string, body: string, at: number, over: Partial<Comment> = {}) =>
  comment(id, { author: 'james', kind: 'comment', body, createdAt: at, ...over })

// ---- mocked data.ts (thread sources + B3 actions) ----------------------------------

export const thread = {
  taskId: TASK_ID,
  task: live<Task | null>(null),
  comments: live<Comment[]>([]),
}
// What useTask / useTaskComments return for an id other than the routed one.
const OTHER_TASK = live<Task | null>(null)
const OTHER_COMMENTS = live<Comment[]>([])

let seq = 0
const nextId = () => `c-new-${++seq}`
const resolved = (_task: Task, _reply: { id: string; body: string }) => Promise.resolve()

export const b3Actions = {
  newCommentId: vi.fn(nextId),
  sendReply: vi.fn(resolved),
}

// Snapshot delivery: the thread hooks subscribe here, so pushThread re-renders the screen the
// way a Firestore snapshot does.
let version = 0
const listeners = new Set<() => void>()
function useSnapshots() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
}

// A new snapshot of the task and/or the comments while the screen is mounted.
export function pushThread(next: { task?: Task | null; comments?: Comment[] }) {
  act(() => {
    if (next.task !== undefined) thread.task = live(next.task)
    if (next.comments !== undefined) thread.comments = live(next.comments)
    version++
    for (const listener of listeners) listener()
  })
}

// Loads one thread (task + comments, everything loaded, no errors), resets every spy.
// `tasks` feeds Threads' useAllTasks (defaults to just this task).
export function setThread(
  task: Task | null,
  opts: { comments?: Comment[]; agents?: AgentDoc[]; tasks?: Task[]; taskId?: string } = {}
) {
  setBoard({ tasks: opts.tasks ?? (task ? [task] : []) })
  board.agents = live(opts.agents ?? [])
  thread.taskId = task?.id ?? opts.taskId ?? TASK_ID
  thread.task = live(task)
  thread.comments = live(opts.comments ?? [])
  seq = 0
  b3Actions.newCommentId.mockReset()
  b3Actions.newCommentId.mockImplementation(nextId)
  b3Actions.sendReply.mockReset()
  b3Actions.sendReply.mockImplementation(resolved)
}

export const dataModule = () => ({
  ...b2DataModule(),
  useTask: (id: string | undefined): LiveStub<Task | null> => {
    useSnapshots()
    return id === thread.taskId ? thread.task : OTHER_TASK
  },
  useTaskComments: (id: string | undefined): LiveStub<Comment[]> => {
    useSnapshots()
    return id === thread.taskId ? thread.comments : OTHER_COMMENTS
  },
  ...b3Actions,
})

// A write that never settles (offline: Firestore keeps it queued) and a permanent failure.
export const pendingWrite = () => new Promise<void>(() => {})
export const deniedWrite = () =>
  Promise.reject(
    Object.assign(new Error('Missing or insufficient permissions.'), {
      name: 'FirebaseError',
      code: 'permission-denied',
    })
  )

export { actions }

// ---- HistorySheet stand-in (its contents are B6's) ---------------------------------

export function HistorySheetStandIn(props: { task: Task; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="History sheet">
      <p>{`history: ${props.task.title}`}</p>
      <button type="button" onClick={props.onClose}>
        Close history
      </button>
    </div>
  )
}
export const historyModule = () => ({ default: HistorySheetStandIn })

// ---- rendering --------------------------------------------------------------------

function WhereAmI() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

type Entry = string | { pathname: string; search?: string; state?: unknown }

// Mounts the thread view on /t/:taskId and `home` (default: a placeholder) on /; the probe
// prints the URL (read it with the B2 fixture's `where`).
export function renderThread(
  entry: Entry,
  threadView: ReactNode,
  home: ReactNode = <h1>Threads home</h1>
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/t/:taskId" element={threadView} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <WhereAmI />
    </MemoryRouter>
  )
}

// ---- reading the screen -----------------------------------------------------------

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// An element's visible-to-a-reader text: its text nodes joined by a space (textContent would
// glue neighbouring elements, "sent" + "Send" → "sentSend"), skipping the composer's own
// contents (a textarea's value can be mirrored into its text) and the location probe.
function textOf(root: Node): string {
  const parts: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('textarea, [data-testid="location"]')) continue
    parts.push(node.textContent ?? '')
  }
  return norm(parts.join(' '))
}

// The whole page's text, as textOf reads it.
export const threadText = () => textOf(document.body)

// The text after the first occurrence of `text`, up to `until` when given.
export function textAfter(text: string, until?: string): string {
  const all = threadText()
  const start = all.indexOf(text)
  if (start < 0) throw new Error(`"${text}" is not on screen`)
  const rest = all.slice(start + text.length)
  if (until === undefined) return rest
  const end = rest.indexOf(until)
  return end < 0 ? rest : rest.slice(0, end)
}

export const occurrences = (text: string) => threadText().split(text).length - 1

// The innermost element whose text contains `text` (outside the composer).
export function deepest(text: string): HTMLElement {
  const want = norm(text)
  const hits = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (el) => !el.closest('textarea, [data-testid="location"]') && textOf(el).includes(want)
  )
  const inner = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)))
  if (inner.length === 0) throw new Error(`"${text}" is not on screen`)
  return inner[0]
}

// The first of the given nodes in document order.
export const firstOf = (...nodes: HTMLElement[]) => nodes.reduce((a, b) => (isBefore(b, a) ? b : a))

export const composer = () => screen.getByRole('textbox', { name: 'Message to the session' })
export const queryComposer = () => screen.queryByRole('textbox', { name: 'Message to the session' })
export const sendButton = () => screen.getByRole('button', { name: 'Send' })
export const readMoreButtons = () => screen.queryAllByRole('button', { name: 'Read more' })

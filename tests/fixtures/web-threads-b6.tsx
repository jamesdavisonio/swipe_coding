// Shared fixture for the web-threads B6 suites (the History sheet and Reopen). Builds on the B2-B5
// fixtures: same task builder, board, thread sources, action spies, logger spy and router. Adds
// the B6 data.ts names (reopenTask, useLogArchive), done tasks with a decision log, the archive
// read the History sheet makes, an oracle for the History sheet's time stamps, and readers for
// one history entry. The suite passes the screens in: this module is loaded by the data.ts mock,
// so it must not import the app.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B6)).dataModule())
import { vi } from 'vitest'
import type { Comment, LogEntry, LogWho, Task } from '../../packages/shared/src/index.ts'
import { DAY, HOUR, NOW, board, live, logSpy, makeTask, type LiveStub } from './web-threads-b2.tsx'
import { setThread, thread } from './web-threads-b3.tsx'
import { dataModule as b5DataModule, setB5Board, textIn } from './web-threads-b5.tsx'

// ---- history and tasks --------------------------------------------------------------------

export const entry = (at: number, who: LogWho, text: string): LogEntry => ({ at, who, text })

// `count` entries, oldest first, one minute apart and ending an hour before NOW: "Line 0.", ...
// (the full stop keeps "Line 1." from matching inside "Line 10.").
export const lines = (count: number): LogEntry[] =>
  Array.from({ length: count }, (_, i) =>
    entry(NOW - HOUR - (count - i) * 60_000, 'session', `Line ${i}.`)
  )

// A finished feature with a short decision log; overrides win.
export const doneTask = (over: Partial<Task> = {}): Task =>
  makeTask('t1', {
    title: 'Ship the nav',
    stage: 'done',
    doneAt: NOW - 2 * DAY,
    summary: 'The nav ships on every page.',
    log: [
      entry(NOW - 3 * DAY, 'james', 'Queued: Ship the nav'),
      entry(NOW - 2 * DAY - HOUR, 'session', 'Merged PR #7'),
      entry(NOW - 2 * DAY, 'system', 'Done'),
    ],
    ...over,
  })

// What the task looks like once reopenTask has gone through (the snapshot after the write).
export const reopened = (task: Task, stage: Task['stage'] = 'main_ci'): Task => ({
  ...task,
  stage,
  doneAt: null,
  reopenedAt: NOW,
  needs: stage === 'after_deploy' ? { kind: 'after_deploy' } : null,
  updatedAt: NOW,
})

// ---- mocked data.ts (B2 ... B5 + the B6 names) --------------------------------------------

const resolved = () => Promise.resolve()

export const b6Actions = {
  reopenTask: vi.fn((_task: Task, _note: string) => Promise.resolve()),
}

// The archive read: useLogArchive(taskId, enabled) returns `archive.source` for the archived
// task once enabled; disabled (or for another task) it reads nothing, like the real hook.
export const archive = {
  taskId: 't1',
  source: live<LogEntry[]>([]),
}
const NOTHING = live<LogEntry[]>([])

export function setArchive(source: LiveStub<LogEntry[]>, taskId = 't1') {
  archive.source = source
  archive.taskId = taskId
}

export const dataModule = () => ({
  ...b5DataModule(),
  useLogArchive: (taskId: string | undefined, enabled: boolean): LiveStub<LogEntry[]> =>
    enabled && taskId === archive.taskId ? archive.source : NOTHING,
  ...b6Actions,
})

// Loads one thread (task + comments) and the board's tasks (default: just this task), everything
// loaded and no errors; every spy reset, reopenTask back to a write that succeeds, no archive.
export function setB6(task: Task, opts: { comments?: Comment[]; tasks?: Task[] } = {}) {
  const tasks = opts.tasks ?? [task]
  setB5Board({ tasks })
  setThread(task, { comments: opts.comments, tasks })
  b6Actions.reopenTask.mockReset()
  b6Actions.reopenTask.mockImplementation(resolved)
  setArchive(live<LogEntry[]>([]))
}

// A reopen that never settles, and one that the snapshot follows: the task (on the thread and on
// the board) becomes `reopened(task, stage)` the way a Firestore snapshot would bring it.
export const pendingReopen = () => new Promise<void>(() => {})
export const reopenUpdatesBoard =
  (stage: Task['stage'] = 'main_ci') =>
  (task: Task) => {
    const next = reopened(task, stage)
    const replace = (list: Task[]) => list.map((t) => (t.id === task.id ? next : t))
    thread.task = live<Task | null>(next)
    board.tasks = live(replace(board.tasks.data))
    return Promise.resolve()
  }

// ---- reading the screen -------------------------------------------------------------------

// A formatter built when this module is evaluated, with the runtime's default locale and time
// zone, the way an app module might build one at its top level. The foreign-clock suite imports
// this module afresh after stubbing the clock and checks that it sees the stubbed defaults.
export const MODULE_SCOPE_DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')

// The History sheet's stamp for `at`, in the device's time zone: "Today HH:MM", "Yesterday HH:MM",
// else "<day> <Mon> HH:MM" (e.g. "24 Oct 18:00").
export function stamp(at: number, now = NOW): string {
  const day = new Date(at)
  const time = `${two(day.getHours())}:${two(day.getMinutes())}`
  if (day.toDateString() === new Date(now).toDateString()) return `Today ${time}`
  if (day.toDateString() === new Date(now - DAY).toDateString()) return `Yesterday ${time}`
  return `${day.getDate()} ${MONTHS[day.getMonth()]} ${time}`
}

export const WHO: Record<LogWho, string> = { james: 'You', session: 'Session', system: 'Board' }

// The element holding one history entry inside `root`: starting from the innermost element with
// the entry's text, the nearest ancestor that also holds its who label and stamp. Throws when no
// element in `root` has the text.
export function entryIn(root: HTMLElement, e: LogEntry): HTMLElement {
  const hits = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) =>
    textIn(el).includes(e.text)
  )
  const inner = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)))
  if (inner.length === 0) throw new Error(`"${e.text}" is not in the sheet`)
  let el = inner[0]
  const wanted = [WHO[e.who], stamp(e.at)]
  while (el !== root && el.parentElement && !wanted.every((part) => textIn(el).includes(part)))
    el = el.parentElement
  return el
}

// Index of `text` in the root's reader text (-1 when absent), for order checks.
export const posOf = (root: HTMLElement, text: string) => textIn(root).indexOf(text)

// Milestones of `name` logged through `track`.
export const milestones = (name: string) =>
  logSpy.event.mock.calls.filter(
    (call) =>
      call[0] === 'milestone_reached' && (call[1] as { milestone?: string }).milestone === name
  )

export const REOPEN_LABEL = 'What is wrong, or what should happen now?'
export const AFTER_DEPLOY_LINE =
  'Goes back to the after-deploy checklist so you can untick a step. Your note is sent to the session.'
export const goesBackTo = (label: string) =>
  `Goes back to ${label}. Your note is sent to the session as the first thing it reads.`

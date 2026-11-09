// Watching pull requests' checks (docs/features/pr-ready.md). A session that reports its PR puts
// the task at stage pr with `pr.checks: 'pending'` and no need; the notifier, while it holds the
// lease, hands every task change to this watcher, which reads the PR's checks through a
// GithubPort at once and then every pollMs:
//
// - every check passed (skipped and neutral count) and GitHub says mergeable, or the PR merged:
//   `passed`, the head commit and the merge need, so the merge card appears (the notifier then
//   notifies it once per head);
// - any check failed, or a merge conflict: `failed` with the names, no need, and one ci_failed
//   comment the session's watcher prints; a failed PR stays watched, and a new run goes back to
//   `pending`;
// - closed unmerged: `closed` and a comment; a PR with no checks passes noChecksGraceMs after it
//   started pending;
// - reads that fail: one api_call_failed WARNING per task per hour, and after giveUpMs of
//   consecutive failed reads `unread`, the merge card anyway and a note.
//
// A merge need written straight by an older session's agent on a PR not known to have passed is
// turned into watching. Each pending run says "Checks running on PR #<n>" once (a comment whose id
// is derived from the run, so a restarted notifier does not repeat it). Every write is a
// transaction that first checks the task still is as read, so a stale read writes nothing.
// Changes and reads are handled one at a time, in order, on the watcher's own queue.
import {
  FieldValue,
  type DocumentChange,
  type DocumentData,
  type Firestore,
  type UpdateData,
} from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  COLLECTIONS as C,
  NEED_KINDS,
  PR_CHECKS,
  STAGES,
  TASK_TYPES,
  isMergeReady,
  taskStages,
  type Comment,
  type PrChecks,
  type TaskPr,
} from '@kanban/shared'
import { errorStatus, firestoreFailure, logFailure } from './app-log.ts'
import type { GithubPort, PrStatus } from './github.ts'

export const PR_POLL_MS = 60_000
export const NO_CHECKS_GRACE_MS = 120_000
export const GITHUB_GIVE_UP_MS = 1_800_000
// A task's read failures are stored as a WARNING at most this often.
export const GITHUB_WARN_EVERY_MS = 3_600_000

// ---- documents, read defensively --------------------------------------------------------------

const PrDoc = z.object({
  number: z.number(),
  url: z.string().min(1),
  checks: z.enum(PR_CHECKS).optional(),
  failed: z.array(z.string()).optional(),
  head: z.string().optional(),
  pendingSince: z.number().optional(),
})
const PrTaskDoc = z.object({
  projectId: z.string().min(1),
  agentId: z.string().nullish(),
  type: z.enum(TASK_TYPES),
  stage: z.enum(STAGES),
  afterDeploy: z.array(z.string()),
  needs: z.object({ kind: z.enum(NEED_KINDS) }).nullable(),
  pr: PrDoc.nullish(),
})
type PrTaskFields = z.infer<typeof PrTaskDoc>
type PrTask = PrTaskFields & { id: string }
// A task whose PR this watcher looks at: one with a url, at stage pr of a chain that has one.
type WatchedTask = PrTask & { pr: TaskPr }

function readPrTask(id: string, data: unknown): WatchedTask | null {
  const parsed = PrTaskDoc.safeParse(data)
  if (!parsed.success) return null
  const task = { ...parsed.data, id }
  const watchable = task.pr && task.stage === 'pr' && taskStages(task).includes('pr')
  return watchable ? (task as WatchedTask) : null
}

// The PRs read again and again; a merge need on a PR not yet ready is turned into watching.
const WATCHED: readonly (PrChecks | undefined)[] = ['pending', 'failed']
const needsWatching = (task: WatchedTask) =>
  task.needs?.kind === 'pr' && !isMergeReady(task.pr.checks)

// ---- what a read means ------------------------------------------------------------------------

const PASSED_CONCLUSIONS: readonly string[] = ['SUCCESS', 'SKIPPED', 'NEUTRAL']
const FAILED_CONCLUSIONS: readonly string[] = [
  'FAILURE',
  'ERROR',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
]
export const MERGE_CONFLICT = 'merge conflict'

export type Verdict =
  | { kind: 'passed' }
  | { kind: 'failed'; names: string[] }
  | { kind: 'running' }
  | { kind: 'closed' }

// The names of the failed checks (a merge conflict as MERGE_CONFLICT), sorted, each once.
function failedNames(s: PrStatus): string[] {
  const names = s.checks
    .filter((c) => c.status === 'COMPLETED' && FAILED_CONCLUSIONS.includes(c.conclusion))
    .map((c) => c.name)
  if (s.mergeable === 'CONFLICTING') names.push(MERGE_CONFLICT)
  return [...new Set(names)].sort()
}

// What a read of the PR says, for a run that started pending at `since`: merged counts as passed
// whatever its checks say; no checks at all pass once `graceMs` has gone by.
export function verdictOf(s: PrStatus, since: number, now: number, graceMs: number): Verdict {
  if (s.state === 'MERGED') return { kind: 'passed' }
  if (s.state === 'CLOSED') return { kind: 'closed' }
  const names = failedNames(s)
  if (names.length > 0) return { kind: 'failed', names }
  const allPassed = s.checks.every(
    (c) => c.status === 'COMPLETED' && PASSED_CONCLUSIONS.includes(c.conclusion)
  )
  const settled = s.checks.length > 0 || now - since >= graceMs
  return allPassed && settled && s.mergeable === 'MERGEABLE'
    ? { kind: 'passed' }
    : { kind: 'running' }
}

// ---- the writes -------------------------------------------------------------------------------

// A comment the watcher writes in a task's thread, under an id of its own (noteId).
interface Note {
  id: string
  kind: 'comment' | 'ci_failed'
  body: string
}

// One change of a watched task: its new pr fields, whether it raises the merge need, and the
// thread comment that goes with it.
interface Transition {
  pr: Partial<Record<keyof TaskPr, unknown>>
  merge?: boolean
  comment?: Note
}

// A note's id: the task, when, what and the head commit. The watcher's notes on a task sort by
// time, as the thread does, and writing the same note again rewrites the same document.
const TIME_DIGITS = 16
const noteId = (task: WatchedTask, at: number, what: string, head = task.pr.head ?? '') =>
  `${task.id}-${String(at).padStart(TIME_DIGITS, '0')}-${what}-${head.replace(/[^A-Za-z0-9]/g, '')}`

const remove = FieldValue.delete()

// How a read moves a watched task on; null when nothing changes. A failed task's next run has no
// grace of its own yet, so it goes back to pending first.
function transitionOf(
  task: WatchedTask,
  s: PrStatus,
  now: number,
  graceMs: number
): Transition | null {
  const { pr } = task
  const since = pr.checks === 'pending' ? (pr.pendingSince ?? now) : now
  const verdict = verdictOf(s, since, now, graceMs)
  switch (verdict.kind) {
    case 'passed':
      return { pr: { checks: 'passed', head: s.head, failed: remove }, merge: true }
    case 'closed':
      return {
        pr: { checks: 'closed' },
        comment: {
          id: noteId(task, now, 'closed'),
          kind: 'comment',
          body: `PR #${pr.number} was closed`,
        },
      }
    case 'failed':
      if (pr.checks === 'failed' && pr.head === s.head) return null
      return {
        pr: { checks: 'failed', failed: verdict.names, head: s.head, pendingSince: now },
        comment: {
          id: noteId(task, now, 'failed', s.head),
          kind: 'ci_failed',
          body: `Checks failed on PR #${pr.number}: ${verdict.names.join(', ')}`,
        },
      }
    case 'running':
      if (pr.checks === 'pending') return null
      return { pr: { checks: 'pending', head: s.head, pendingSince: now, failed: remove } }
  }
}

const giveUp = (task: WatchedTask, now: number): Transition => ({
  pr: { checks: 'unread' },
  merge: true,
  comment: {
    id: noteId(task, now, 'unread'),
    kind: 'comment',
    body: `Couldn't read the checks of PR #${task.pr.number}; showing the merge card anyway`,
  },
})

// A run's "Checks running" note: one per start of the run and head commit.
const runningNote = (task: WatchedTask): Note => ({
  id: noteId(task, task.pr.pendingSince ?? 0, 'running'),
  kind: 'comment',
  body: `Checks running on PR #${task.pr.number}`,
})

// ---- the watcher ------------------------------------------------------------------------------

export interface PrWatcher {
  // Queues one task change (a removed task is no longer watched).
  enqueue(change: DocumentChange): void
  // Stops at once: no more reads, whatever is still queued is skipped.
  halt(): void
  // Halts, then waits for the read in progress.
  stop(): Promise<void>
}

export interface PrWatcherOptions {
  db: Firestore
  github: GithubPort
  now: () => number
  pollMs: number
  noChecksGraceMs: number
  giveUpMs: number
}

// A watched task as last seen, and its read failures since the last read that worked.
interface Watch {
  task: WatchedTask
  failingSince: number | null
  warnedAt: number | null
}

class TaskPrWatcher implements PrWatcher {
  private readonly opts: PrWatcherOptions
  private readonly watched = new Map<string, Watch>()
  // The "Checks running" comments known to exist.
  private readonly announced = new Set<string>()
  private queue: Promise<void> = Promise.resolve()
  private pollQueued = false
  private readonly timer: NodeJS.Timeout
  private stopped = false

  constructor(opts: PrWatcherOptions) {
    this.opts = opts
    this.timer = setInterval(() => this.queuePoll(), opts.pollMs)
  }

  enqueue(change: DocumentChange): void {
    const id = change.doc.id
    const task = change.type === 'removed' ? null : readPrTask(id, change.doc.data())
    this.run(id, () => this.onChange(id, task))
  }

  halt(): void {
    this.stopped = true
    clearInterval(this.timer)
  }

  async stop(): Promise<void> {
    this.halt()
    await this.queue
  }

  // Queues `job` for the task.
  private run(taskId: string, job: () => Promise<void>): void {
    this.queue = this.queue.then(() => this.safely(taskId, job))
  }

  // Never rejects: a failure on one task is logged and the next job runs.
  private async safely(taskId: string, job: () => Promise<void>): Promise<void> {
    if (this.stopped) return
    try {
      await job()
    } catch (err) {
      firestoreFailure('WARNING', `PR watcher failed on task ${taskId}`, err as Error, taskId)
    }
  }

  // Queues one read of every watched PR, unless one is already queued.
  private queuePoll(): void {
    if (this.pollQueued) return
    this.pollQueued = true
    this.queue = this.queue.then(async () => {
      this.pollQueued = false
      for (const id of [...this.watched.keys()]) await this.safely(id, () => this.read(id))
    })
  }

  private async onChange(id: string, task: WatchedTask | null): Promise<void> {
    if (task && needsWatching(task)) return this.startWatching(task)
    if (!task || !WATCHED.includes(task.pr.checks)) {
      this.watched.delete(id)
      return
    }
    const known = this.watched.get(id)
    if (known) known.task = task
    else this.watched.set(id, { task, failingSince: null, warnedAt: null })
    if (task.pr.checks === 'pending') await this.announce(task)
    if (!known) await this.read(id)
  }

  // An older session's merge need on a PR not known to have passed: cleared, and the PR pending.
  private async startWatching(task: WatchedTask): Promise<void> {
    await this.write(task, (current) => needsWatching(current), {
      needs: null,
      'pr.checks': 'pending',
      'pr.pendingSince': this.opts.now(),
      'pr.failed': remove,
    })
  }

  // Writes the run's "Checks running" comment unless it exists.
  private async announce(task: WatchedTask): Promise<void> {
    const note = runningNote(task)
    if (this.announced.has(note.id)) return
    const ref = this.opts.db.collection(C.comments).doc(note.id)
    await this.opts.db.runTransaction(async (tx) => {
      if (!(await tx.get(ref)).exists) tx.set(ref, this.comment(task, note))
    })
    this.announced.add(note.id)
  }

  private async read(id: string): Promise<void> {
    const watch = this.watched.get(id)
    if (!watch || this.stopped) return
    let status: PrStatus
    try {
      status = await this.opts.github.prStatus(watch.task.pr.url)
    } catch (err) {
      await this.readFailed(watch, err)
      return
    }
    watch.failingSince = null
    const next = transitionOf(watch.task, status, this.opts.now(), this.opts.noChecksGraceMs)
    if (next) await this.apply(watch, next)
  }

  // A failed read: a WARNING at most once an hour per task; a pending PR that could not be read
  // for giveUpMs is shown anyway.
  private async readFailed(watch: Watch, err: unknown): Promise<void> {
    const t = this.opts.now()
    watch.failingSince ??= t
    const { task } = watch
    if (watch.warnedAt === null || t - watch.warnedAt >= GITHUB_WARN_EVERY_MS) {
      watch.warnedAt = t
      await logFailure({
        severity: 'WARNING',
        event_type: 'api_call_failed',
        message: `Couldn't read the checks of PR #${task.pr.number} (task ${task.id}): ${err instanceof Error ? err.message : String(err)}`,
        context: { target: 'github', task_id: task.id, status: errorStatus(err) },
      })
    }
    const givingUp = task.pr.checks === 'pending' && t - watch.failingSince >= this.opts.giveUpMs
    if (givingUp && !this.stopped) await this.apply(watch, giveUp(task, t))
  }

  // Applies `next` when the task is still as this watcher last saw it; the merge need only on a
  // task that waits on nothing else.
  private async apply(watch: Watch, next: Transition): Promise<void> {
    const before = watch.task
    const pr = Object.fromEntries(Object.entries(next.pr).map(([k, v]) => [`pr.${k}`, v]))
    const t = this.opts.now()
    const patch: UpdateData<DocumentData> = {
      ...pr,
      updatedAt: t,
      ...(next.merge ? { needs: { kind: 'pr' } } : {}),
      ...(next.comment ? { lastCommentAt: t, unread: true } : {}),
    }
    const same = (current: WatchedTask) =>
      current.pr.url === before.pr.url &&
      current.pr.checks === before.pr.checks &&
      current.pr.head === before.pr.head &&
      current.pr.pendingSince === before.pr.pendingSince &&
      (!next.merge || current.needs === null)
    if (!(await this.write(before, same, patch, next.comment))) return
    // Until its snapshot arrives, the task is as written: still watched, or no longer.
    const settled = { ...before.pr, ...next.pr } as TaskPr
    if (next.pr.failed === remove) delete settled.failed
    if (!WATCHED.includes(settled.checks)) this.watched.delete(before.id)
    else watch.task = { ...before, pr: settled }
  }

  // In one transaction: when the task still passes `check`, applies `patch` and adds the comment,
  // if any. False when the task had moved on, so nothing was written.
  private write(
    task: WatchedTask,
    check: (current: WatchedTask) => boolean,
    patch: UpdateData<DocumentData>,
    comment?: Transition['comment']
  ): Promise<boolean> {
    const ref = this.opts.db.collection(C.tasks).doc(task.id)
    return this.opts.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const current = snap.exists ? readPrTask(task.id, snap.data()) : null
      if (this.stopped || !current || !check(current)) return false
      tx.update(ref, patch)
      if (comment)
        tx.set(this.opts.db.collection(C.comments).doc(comment.id), this.comment(current, comment))
      return true
    })
  }

  // The notifier's comment in the task's thread. A ci_failed report waits for the session's
  // watcher (deliveredAt null); anything else is the board's own words, never delivered.
  private comment(task: WatchedTask, c: Note): Omit<Comment, 'id'> {
    const t = this.opts.now()
    return {
      taskId: task.id,
      projectId: task.projectId,
      agentId: task.agentId ?? null,
      author: 'agent',
      kind: c.kind,
      body: c.body,
      createdAt: t,
      deliveredAt: c.kind === 'ci_failed' ? null : t,
      workingAt: null,
      handledAt: null,
    }
  }
}

// The PR watcher the notifier runs while it holds the lease.
export function startPrWatcher(opts: PrWatcherOptions): PrWatcher {
  return new TaskPrWatcher(opts)
}

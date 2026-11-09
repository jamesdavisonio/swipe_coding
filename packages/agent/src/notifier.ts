#!/usr/bin/env node
// The notifier (docs/features/notifier.md): one process on James's PC that watches the board and
// sends every session's decision notifications, whatever agent version wrote the decision.
//
// It listens to `tasks` and, for a task whose need is a spec or a question, works out a decision
// key ('spec:<id of the newest session spec brief comment>' or 'spec:none', 'question:<text>').
// When the key differs from the task's stored `notified`, it sends the notice (notifyDecision) and
// stores the key; when the need stops being a decision, it removes `notified`. Changes are handled
// one at a time, in snapshot order. A lease (notifier/lease) makes sure only one notifier sends.
// While it holds the lease it also starts the sessions James asks for from the phone: every task
// change goes to the launcher too (launcher.ts, docs/features/launch-session.md); and it watches
// the checks of every PR a session reported: every task change goes to the PR watcher too
// (pr-watcher.ts, docs/features/pr-ready.md), which raises the merge need once they pass. That
// merge card is notified once per PR head, under the decision key 'merge:<number>:<head>'.
//
// Command line: `node packages/agent/src/notifier.ts` (`npm run notifier`, with --watch). It logs
// to stderr / agent.log only; when another notifier holds the lease it says so and exits 1.
import { hostname as osHostname } from 'node:os'
import {
  FieldValue,
  type DocumentChange,
  type DocumentReference,
  type Firestore,
  type QuerySnapshot,
} from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  COLLECTIONS as C,
  NEED_KINDS,
  PR_CHECKS,
  STAGES,
  isMergeReady,
  latestBrief,
  type Task,
} from '@kanban/shared'
import { firestoreFailure } from './app-log.ts'
import { boardStatus, getDb, log } from './firestore.ts'
import { ghPort, type GithubPort } from './github.ts'
import { claudeLaunchPort, startLauncher, type LaunchPort, type Launcher } from './launcher.ts'
import {
  GITHUB_GIVE_UP_MS,
  NO_CHECKS_GRACE_MS,
  PR_POLL_MS,
  startPrWatcher,
  type PrWatcher,
} from './pr-watcher.ts'
import { fcmPush, notifyDecision, notifyMerge, type PushPort } from './push.ts'

export interface Notifier {
  stop(): Promise<void>
}

export interface NotifierOptions {
  db?: Firestore
  push?: PushPort
  // How sessions are started (default: the `claude` executable).
  launch?: LaunchPort
  // How PRs' checks are read (default: the `gh` executable; nothing under the emulator).
  github?: GithubPort
  // How often each watched PR is read; how long a PR with no checks waits before it counts as
  // passed; how long reads may fail before the merge card is shown anyway.
  prPollMs?: number
  noChecksGraceMs?: number
  githubGiveUpMs?: number
  now?: () => number
  leaseMs?: number
  heartbeatMs?: number
  retryMs?: number
}

export class NotifierBusyError extends Error {
  constructor(message = 'another notifier is running') {
    super(message)
    this.name = 'NotifierBusyError'
  }
}

// How old a lease may be before another notifier takes it over, how often the holder refreshes
// it, and how long a dead tasks listener waits before it is re-created.
export const LEASE_MS = 120_000
export const HEARTBEAT_MS = 30_000
export const RETRY_MS = 5_000
const LEASE_DOC = 'lease'
const EXIT_OK = 0
const EXIT_FAILED = 1

// ---- documents, read defensively --------------------------------------------------------------

const NeedDoc = z.object({
  kind: z.enum(NEED_KINDS),
  question: z.string().optional(),
  options: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
})
const PrDoc = z.object({
  number: z.number(),
  checks: z.enum(PR_CHECKS).optional(),
  head: z.string().optional(),
})
const TaskDoc = z.object({
  projectId: z.string().min(1),
  title: z.string(),
  stage: z.enum(STAGES),
  needs: NeedDoc.nullable(),
  notified: z.string().optional(),
  pr: PrDoc.nullish(),
})
type NotifierTask = Pick<Task, 'id' | 'projectId' | 'title' | 'stage' | 'needs' | 'notified'> & {
  pr?: z.infer<typeof PrDoc> | null
}

const CommentDoc = z.object({
  author: z.enum(['james', 'agent']),
  body: z.string(),
  createdAt: z.number(),
})
type SpecComment = z.infer<typeof CommentDoc> & { id: string }

const LeaseDoc = z.object({
  pid: z.number().int(),
  hostname: z.string(),
  startedAt: z.number(),
  lastSeen: z.number(),
})
type Lease = z.infer<typeof LeaseDoc>

// ---- the lease ----------------------------------------------------------------------------------

// Whether a process with this pid runs on this machine. EPERM means it runs as someone else.
function pidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// A lease is live while it was seen within leaseMs, unless its holder ran on this host and has
// gone (a watch-mode restart on Windows kills the old process without stop()).
function leaseIsLive(lease: Lease, now: number, leaseMs: number): boolean {
  if (now - lease.lastSeen >= leaseMs) return false
  return lease.hostname !== osHostname() || pidRunning(lease.pid)
}

const isOurs = (lease: Lease) => lease.pid === process.pid && lease.hostname === osHostname()

function readLease(data: unknown): Lease | null {
  const parsed = LeaseDoc.safeParse(data)
  return parsed.success ? parsed.data : null
}

const busyMessage = (held: Lease) =>
  `another notifier is running (pid ${held.pid} on ${held.hostname}, last seen ${new Date(held.lastSeen).toISOString()})`

// Claims the lease in a transaction, so two notifiers starting together cannot both hold it.
async function claimLease(ref: DocumentReference, now: number, leaseMs: number): Promise<void> {
  await ref.firestore.runTransaction(async (tx) => {
    const held = readLease((await tx.get(ref)).data())
    if (held && leaseIsLive(held, now, leaseMs)) throw new NotifierBusyError(busyMessage(held))
    tx.set(ref, { pid: process.pid, hostname: osHostname(), startedAt: now, lastSeen: now })
  })
}

// Refreshes lastSeen while the lease is still ours; false once another notifier has taken it.
const refreshLease = (ref: DocumentReference, now: number): Promise<boolean> =>
  ref.firestore.runTransaction(async (tx) => {
    const held = readLease((await tx.get(ref)).data())
    if (!held || !isOurs(held)) return false
    tx.update(ref, { lastSeen: now })
    return true
  })

// Deletes the lease if it is still ours.
const releaseLease = (ref: DocumentReference): Promise<void> =>
  ref.firestore.runTransaction(async (tx) => {
    const held = readLease((await tx.get(ref)).data())
    if (held && isOurs(held)) tx.delete(ref)
  })

// ---- decisions ----------------------------------------------------------------------------------

function readTask(change: DocumentChange): NotifierTask | null {
  const parsed = TaskDoc.safeParse(change.doc.data())
  return parsed.success ? { ...parsed.data, id: change.doc.id } : null
}

// The task's newest session comment that holds a well-formed spec brief, if any.
async function latestSpecComment(db: Firestore, taskId: string): Promise<SpecComment | null> {
  const snap = await db.collection(C.comments).where('taskId', '==', taskId).get()
  const comments = snap.docs
    .flatMap((d) => {
      const parsed = CommentDoc.safeParse(d.data())
      return parsed.success ? [{ ...parsed.data, id: d.id }] : []
    })
    .sort((a, b) => a.createdAt - b.createdAt)
  return latestBrief(comments, 'spec')?.comment ?? null
}

interface Decision {
  key: string
  specBody?: string
  merge?: boolean
}

// A merge card the PR watcher raised (its checks passed, or could not be read): one per PR head.
// A merge need of an older session's agent, not yet checked, is no card yet.
function mergeDecision(task: NotifierTask): Decision | null {
  const pr = task.pr
  if (!pr || !isMergeReady(pr.checks)) return null
  return { key: `merge:${pr.number}:${pr.head ?? ''}`, merge: true }
}

// The decision the task waits on, with its key; null when its need is not a decision.
async function decisionOf(db: Firestore, task: NotifierTask): Promise<Decision | null> {
  if (task.needs?.kind === 'question') return { key: `question:${task.needs.question ?? ''}` }
  if (task.needs?.kind === 'pr') return mergeDecision(task)
  if (task.needs?.kind !== 'spec') return null
  const brief = await latestSpecComment(db, task.id)
  return brief ? { key: `spec:${brief.id}`, specBody: brief.body } : { key: 'spec:none' }
}

// ---- the notifier -------------------------------------------------------------------------------

interface Settings {
  db: Firestore
  push: PushPort
  launch: LaunchPort
  github: GithubPort
  prPollMs: number
  noChecksGraceMs: number
  githubGiveUpMs: number
  now: () => number
  leaseMs: number
  heartbeatMs: number
  retryMs: number
}

class TaskNotifier implements Notifier {
  private readonly opts: Settings
  private readonly lease: DocumentReference
  // The key this notifier last stored per task (null: removed). A snapshot queued before our own
  // write still carries the old stored value; this map holds what was written since.
  private readonly handled = new Map<string, string | null>()
  private queue: Promise<void> = Promise.resolve()
  // Starts the sessions James asks for; exists only while this notifier holds the lease.
  private launcher: Launcher | null = null
  // Watches the reported PRs' checks; exists only while this notifier holds the lease.
  private prs: PrWatcher | null = null
  private unsubscribe: (() => void) | null = null
  private heartbeat: NodeJS.Timeout | null = null
  private retry: NodeJS.Timeout | null = null
  private stopped = false
  private markReady: () => void = () => {}
  // Settles once the first snapshot has been handled, or the first listener has failed.
  private readonly ready = new Promise<void>((resolve) => (this.markReady = resolve))

  constructor(settings: Settings) {
    this.opts = settings
    this.lease = settings.db.collection(C.notifier).doc(LEASE_DOC)
  }

  async start(): Promise<void> {
    await claimLease(this.lease, this.opts.now(), this.opts.leaseMs)
    log(`notifier started: holds the lease (pid ${process.pid} on ${osHostname()})`)
    this.launcher = startLauncher({ db: this.opts.db, spawn: this.opts.launch, now: this.opts.now })
    this.prs = startPrWatcher({
      db: this.opts.db,
      github: this.opts.github,
      now: this.opts.now,
      pollMs: this.opts.prPollMs,
      noChecksGraceMs: this.opts.noChecksGraceMs,
      giveUpMs: this.opts.githubGiveUpMs,
    })
    this.heartbeat = setInterval(() => void this.beat(), this.opts.heartbeatMs)
    this.listen()
    await this.ready
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.halt()
    await this.queue
    await this.launcher?.stop()
    await this.prs?.stop()
    await releaseLease(this.lease)
    log('notifier stopped: lease released')
  }

  // Stops listening and the timers; whatever is still queued is skipped.
  private halt(): void {
    this.stopped = true
    this.launcher?.halt()
    this.prs?.halt()
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.heartbeat) clearInterval(this.heartbeat)
    if (this.retry) clearTimeout(this.retry)
  }

  private async beat(): Promise<void> {
    try {
      if (this.stopped || (await refreshLease(this.lease, this.opts.now()))) return
      log('notifier lost its lease to another notifier: no longer sending')
      this.halt()
    } catch (err) {
      firestoreFailure('WARNING', 'notifier heartbeat failed', err as Error)
    }
  }

  private listen(): void {
    if (this.stopped) return
    this.unsubscribe = this.opts.db.collection(C.tasks).onSnapshot(
      (snap) => this.enqueue(snap),
      (err) => this.listenerDied(err)
    )
  }

  private listenerDied(err: Error): void {
    firestoreFailure(
      'ERROR',
      `notifier tasks listener died, retrying in ${this.opts.retryMs} ms`,
      err
    )
    this.unsubscribe = null
    this.markReady()
    this.retry = setTimeout(() => this.listen(), this.opts.retryMs)
  }

  private enqueue(snap: QuerySnapshot): void {
    for (const change of snap.docChanges()) {
      this.prs?.enqueue(change)
      if (change.type === 'removed') continue
      this.queue = this.queue.then(() => this.handleChange(change))
      this.launcher?.enqueue(change)
    }
    this.queue = this.queue.then(() => this.markReady())
  }

  // Never rejects: a failure on one task is logged and the next change is handled.
  private async handleChange(change: DocumentChange): Promise<void> {
    const task = readTask(change)
    if (this.stopped || !task) return
    try {
      await this.handle(task)
    } catch (err) {
      firestoreFailure('WARNING', `notifier failed on task ${task.id}`, err as Error, task.id)
    }
  }

  private async handle(task: NotifierTask): Promise<void> {
    const stored = this.handled.has(task.id)
      ? (this.handled.get(task.id) ?? null)
      : (task.notified ?? null)
    const decision = await decisionOf(this.opts.db, task)
    if ((decision?.key ?? null) === stored) return
    const ref = this.opts.db.collection(C.tasks).doc(task.id)
    if (!decision) {
      await ref.update({ notified: FieldValue.delete() })
      this.handled.set(task.id, null)
      return
    }
    if (decision.merge) await notifyMerge(this.opts.db, this.opts.push, task)
    else await notifyDecision(this.opts.db, this.opts.push, task, decision.specBody)
    await ref.update({ notified: decision.key })
    this.handled.set(task.id, decision.key)
  }
}

// Starts the notifier: claims the lease (rejects with NotifierBusyError when another live notifier
// holds it), then handles every task as it is now and every change after. Resolves once the tasks
// as they were at the start have been handled.
export async function startNotifier(opts: NotifierOptions = {}): Promise<Notifier> {
  const notifier = new TaskNotifier({
    db: opts.db ?? getDb(),
    push: opts.push ?? fcmPush(),
    launch: opts.launch ?? claudeLaunchPort(),
    github: opts.github ?? ghPort(),
    prPollMs: opts.prPollMs ?? PR_POLL_MS,
    noChecksGraceMs: opts.noChecksGraceMs ?? NO_CHECKS_GRACE_MS,
    githubGiveUpMs: opts.githubGiveUpMs ?? GITHUB_GIVE_UP_MS,
    now: opts.now ?? Date.now,
    leaseMs: opts.leaseMs ?? LEASE_MS,
    heartbeatMs: opts.heartbeatMs ?? HEARTBEAT_MS,
    retryMs: opts.retryMs ?? RETRY_MS,
  })
  await notifier.start()
  return notifier
}

// ---- command line -------------------------------------------------------------------------------

async function main(): Promise<void> {
  try {
    const notifier = await startNotifier()
    const shutdown = () =>
      void notifier.stop().then(
        () => process.exit(EXIT_OK),
        (err: Error) => {
          // The process ends right away, so only the stderr / agent.log line can be relied on.
          log(`notifier stop failed: ${err.message}`)
          process.exit(EXIT_FAILED)
        }
      )
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  } catch (err) {
    log(`notifier not started: ${(err as Error).message}`)
    process.exitCode = EXIT_FAILED
    // Nothing else holds the process open once the Firestore client is closed.
    if (boardStatus().mode !== 'offline') await getDb().terminate()
  }
}

if (import.meta.main) await main()

// Starting sessions from the phone (docs/features/launch-session.md). James's New session sheet
// writes a task with `launch: { state: 'requested' }`; the notifier, while it holds the lease,
// hands every task change to the launcher, which starts one Claude Code background session for
// each request whose project lives on this PC.
//
// At most once: a request is claimed in a transaction (requested -> starting) before anything is
// started, then moved to `started` with the session id, or to `failed` with the reason, one agent
// comment on the task and one api_call_failed WARNING. A claim this launcher did not make (left
// in `starting` by a notifier that stopped mid-start) fails as `interrupted`; it is never started
// again. Changes are handled one at a time, in snapshot order.
//
// The session is started through a LaunchPort. The real one runs the `claude` executable with an
// argument array and no shell, so nothing in a task's title or description can run a command.
import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { hostname as osHostname } from 'node:os'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import type { DocumentChange, Firestore, UpdateData } from 'firebase-admin/firestore'
import { z } from 'zod'
import { COLLECTIONS as C, LAUNCH_STATES, type Comment, type LaunchState } from '@kanban/shared'
import { firestoreFailure, logFailure } from './app-log.ts'
import { log } from './firestore.ts'

export type LaunchRequest = { cwd: string; name: string; worktree: string | null; prompt: string }

export interface LaunchPort {
  start(req: LaunchRequest): Promise<{ sessionId: string }>
}

// ---- the claude command line ------------------------------------------------------------------

// The arguments the real port gives `claude`: a background session with Remote Control, named
// after the task, in a new worktree when there is one, the first message last. One element each.
export function claudeArgs(req: LaunchRequest): string[] {
  return [
    '--bg',
    '--remote-control',
    req.name,
    '-n',
    req.name,
    ...(req.worktree === null ? [] : ['-w', req.worktree]),
    req.prompt,
  ]
}

// `claude --bg` prints "backgrounded · <session id> · <name>" once the session runs, on either
// stream and possibly coloured, so both are scanned with ANSI escape sequences stripped.
const SESSION_LINE = /backgrounded · (\S+) · /
const sessionIdIn = (output: string): string | undefined =>
  SESSION_LINE.exec(stripVTControlCharacters(output))?.[1]
// A start that has printed no session id by then is given up (and the process stopped).
export const LAUNCH_TIMEOUT_MS = 120_000

class LaunchError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'LaunchError'
    this.code = code
  }
}

const lastLine = (text: string): string | undefined =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .pop()

// Why the process ended without a session: the last line of its error output, else its code.
function exitError(code: number | null, signal: string | null, stderr: string): LaunchError {
  if (code === null) return new LaunchError(`claude was stopped (${signal})`, `signal_${signal}`)
  return new LaunchError(lastLine(stderr) ?? `claude exited with code ${code}`, `exit_${code}`)
}

// Runs `command` in `cwd`, never through a shell, and resolves with the session id it prints.
function runClaude(command: string, args: string[], cwd: string): Promise<{ sessionId: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: 'pipe' })
    child.stdin.end()
    let stdout = ''
    let stderr = ''
    let settled = false
    // Once settled, the child (a background session may keep running) never holds the notifier.
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.unref()
      child.stdout.destroy()
      child.stderr.destroy()
      finish()
    }
    const found = (output: string) => {
      const id = sessionIdIn(output)
      if (id) settle(() => resolve({ sessionId: id }))
    }
    const timer = setTimeout(() => {
      settle(() => reject(new LaunchError('claude printed no session id in time', 'timeout')))
      child.kill()
    }, LAUNCH_TIMEOUT_MS)
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      if (settled) return
      stdout += chunk
      found(stdout)
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      if (settled) return
      stderr += chunk
      found(stderr)
    })
    child.on('error', (err) => settle(() => reject(err)))
    child.on('close', (code, signal) =>
      settle(() =>
        reject(
          code === 0
            ? new LaunchError('claude printed no session id', 'no_session_id')
            : exitError(code, signal, stderr)
        )
      )
    )
  })
}

// The real port: `command` (default `claude`) with `prefixArgs` before claudeArgs(req).
export function claudeLaunchPort(
  opts: { command?: string; prefixArgs?: string[] } = {}
): LaunchPort {
  const command = opts.command ?? 'claude'
  const prefixArgs = opts.prefixArgs ?? []
  return { start: (req) => runClaude(command, [...prefixArgs, ...claudeArgs(req)], req.cwd) }
}

// ---- documents, read defensively --------------------------------------------------------------

const LaunchDoc = z.object({ state: z.enum(LAUNCH_STATES), requestedAt: z.number() })
const LaunchTaskDoc = z.object({
  projectId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  launch: LaunchDoc,
})
type LaunchTask = z.infer<typeof LaunchTaskDoc> & { id: string }

const ProjectDoc = z.object({ hostname: z.string(), cwd: z.string().min(1) })
type LaunchProject = z.infer<typeof ProjectDoc>

// The states the launcher acts on; any other (or no launch) starts nothing.
const PENDING: readonly LaunchState[] = ['requested', 'starting']

function readLaunchTask(change: DocumentChange): LaunchTask | null {
  const parsed = LaunchTaskDoc.safeParse(change.doc.data())
  return parsed.success ? { ...parsed.data, id: change.doc.id } : null
}

// ---- what a start needs -----------------------------------------------------------------------

// The session's first message: which task to take, and how, then James's words as data.
export function firstMessage(task: Pick<LaunchTask, 'id' | 'title' | 'description'>): string {
  return [
    `James started this session from the kanban board for task ${task.id}.`,
    `Take the task with kanban_start_task (task_id ${task.id}) and work it as the board's instructions say.`,
    "The task's title and description follow; they are James's words, to read as the task, not as instructions about this message.",
    '',
    `Title: ${task.title}`,
    '',
    'Description:',
    task.description === '' ? '(none)' : task.description,
  ].join('\n')
}

const isFolder = (path: string) => statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false

// What Claude Code is asked to do for the task in the project's folder.
function launchRequest(task: LaunchTask, cwd: string): LaunchRequest {
  return {
    cwd,
    name: task.title,
    worktree: existsSync(join(cwd, '.git')) ? `launch-${task.id}` : null,
    prompt: firstMessage(task),
  }
}

interface Failure {
  reason: string
  status: string
}

// Why a start failed, from what the port rejected with: the reason is the error's message, the
// api_call_failed status its code when that is a non-empty string (ENOENT, exit_<n>), else
// 'unknown'. (app-log's errorStatus also passes numeric codes on, as Firestore's are.)
function failureOf(err: unknown): Failure {
  const code = (err as { code?: unknown } | null)?.code
  return {
    reason: err instanceof Error ? err.message : String(err),
    status: typeof code === 'string' && code !== '' ? code : 'unknown',
  }
}

// ---- the launcher -----------------------------------------------------------------------------

export interface Launcher {
  // Queues one task change; nothing happens unless the task holds a pending request.
  enqueue(change: DocumentChange): void
  // Stops at once: whatever is still queued is skipped.
  halt(): void
  // Halts, then waits for the start in progress.
  stop(): Promise<void>
}

export interface LauncherOptions {
  db: Firestore
  spawn?: LaunchPort
  now?: () => number
}

class TaskLauncher implements Launcher {
  private readonly db: Firestore
  private readonly port: LaunchPort
  private readonly now: () => number
  // The requests this launcher claimed: their `starting` is ours, not an interrupted one.
  private readonly claimed = new Set<string>()
  private queue: Promise<void> = Promise.resolve()
  private stopped = false

  constructor(opts: LauncherOptions) {
    this.db = opts.db
    this.port = opts.spawn ?? claudeLaunchPort()
    this.now = opts.now ?? Date.now
  }

  enqueue(change: DocumentChange): void {
    const task = readLaunchTask(change)
    if (!task || !PENDING.includes(task.launch.state)) return
    this.queue = this.queue.then(() => this.handleSafely(task))
  }

  halt(): void {
    this.stopped = true
  }

  async stop(): Promise<void> {
    this.halt()
    await this.queue
  }

  // Never rejects: a failure on one task is logged and the next change is handled.
  private async handleSafely(task: LaunchTask): Promise<void> {
    if (this.stopped) return
    try {
      await this.handle(task)
    } catch (err) {
      firestoreFailure('WARNING', `launcher failed on task ${task.id}`, err as Error, task.id)
    }
  }

  private async handle(task: LaunchTask): Promise<void> {
    if (task.launch.state === 'starting' && this.claimed.has(task.id)) return
    const project = await this.projectOnThisPc(task.projectId)
    if (!project) return
    if (task.launch.state === 'starting') {
      await this.fail(task, { reason: 'interrupted', status: 'interrupted' })
      return
    }
    if (!(await this.transition(task, 'requested', { 'launch.state': 'starting' }))) return
    this.claimed.add(task.id)
    await this.launch(task, project)
  }

  // The task's project when its folder is on this PC; null for another PC's (or none).
  private async projectOnThisPc(projectId: string): Promise<LaunchProject | null> {
    const snap = await this.db.collection(C.projects).doc(projectId).get()
    const parsed = ProjectDoc.safeParse(snap.data())
    if (!parsed.success) return null
    const here = parsed.data.hostname.toLowerCase() === osHostname().toLowerCase()
    return here ? parsed.data : null
  }

  private async launch(task: LaunchTask, project: LaunchProject): Promise<void> {
    if (!isFolder(project.cwd)) {
      await this.fail(task, {
        reason: `folder not found: ${project.cwd}`,
        status: 'folder_not_found',
      })
      return
    }
    log(`launcher: starting a session for task ${task.id} in ${project.cwd}`)
    let sessionId: string
    try {
      sessionId = (await this.port.start(launchRequest(task, project.cwd))).sessionId
    } catch (err) {
      await this.fail(task, failureOf(err))
      return
    }
    await this.transition(task, 'starting', {
      'launch.state': 'started',
      'launch.startedAt': this.now(),
      'launch.sessionId': sessionId,
    })
    log(`launcher: task ${task.id} runs in session ${sessionId}`)
  }

  // Moves a claim to `failed` with its comment, then logs the warning; once, whoever calls.
  private async fail(task: LaunchTask, failure: Failure): Promise<void> {
    const t = this.now()
    const failed = await this.transition(
      task,
      'starting',
      {
        'launch.state': 'failed',
        'launch.failedAt': t,
        'launch.reason': failure.reason,
        lastCommentAt: t,
        updatedAt: t,
        unread: true,
      },
      `Couldn't start a session: ${failure.reason}`
    )
    if (!failed) return
    await logFailure({
      severity: 'WARNING',
      event_type: 'api_call_failed',
      message: `Couldn't start a session for task ${task.id}: ${failure.reason}`,
      context: { target: 'claude', task_id: task.id, status: failure.status },
    })
  }

  // In one transaction: when the task's launch is still `from`, applies `patch` (and adds the
  // agent comment, if any). False when the launch had moved on, so nothing was written.
  private transition(
    task: LaunchTask,
    from: LaunchState,
    patch: UpdateData<Record<string, unknown>>,
    comment?: string
  ): Promise<boolean> {
    const ref = this.db.collection(C.tasks).doc(task.id)
    return this.db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).get('launch.state') !== from) return false
      tx.update(ref, patch)
      if (comment !== undefined)
        tx.set(this.db.collection(C.comments).doc(), this.comment(task, comment))
      return true
    })
  }

  private comment(task: LaunchTask, body: string): Omit<Comment, 'id'> {
    const t = this.now()
    return {
      taskId: task.id,
      projectId: task.projectId,
      agentId: null,
      author: 'agent',
      kind: 'comment',
      body,
      createdAt: t,
      deliveredAt: t, // the board's own words are never delivered to a session
      workingAt: null,
      handledAt: null,
    }
  }
}

// The launcher the notifier runs while it holds the lease.
export function startLauncher(opts: LauncherOptions): Launcher {
  return new TaskLauncher(opts)
}

// All Firestore reads/writes for one agent (= one Claude Code session).
import { homedir, hostname as osHostname } from 'node:os'
import { join } from 'node:path'
import {
  FieldValue,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
  type WriteBatch,
} from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  AGENT_HEARTBEAT_MS,
  COLLECTIONS as C,
  TASK_TYPES,
  forJamesTaskId,
  initialTaskFields,
  isAgentOnline,
  isDone,
  isQueued,
  isTaskVisible,
  projectIdFor,
  projectNameFor,
  suggestedNext,
  taskPhase,
  taskStages,
  type AgentDoc,
  type Comment,
  type NeedKind,
  type Project,
  type SessionCommentKind,
  type Stage,
  type Task,
  type TaskNeed,
  type TaskPhase,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { errorStatus, logFailure, setLogIdentity } from './app-log.ts'
import { getDb, log } from './firestore.ts'
import { readRemoteUrl } from './remote.ts'

// A Firestore-side failure of a listener or batch: the stderr / agent.log line, plus a stored
// event (WARNING for a batch, ERROR for a dead listener).
function firestoreFailure(
  severity: 'WARNING' | 'ERROR',
  what: string,
  err: Error,
  taskId?: string
) {
  log(`${what}: ${err.message}`)
  void logFailure({
    severity,
    event_type: 'api_call_failed',
    message: err.message,
    context: {
      target: 'firestore',
      status: errorStatus(err),
      ...(taskId ? { task_id: taskId } : {}),
    },
  })
}

// The session's Claude-app link as Claude Code's sessions file has it right now. Home and pid are
// read at each call: the pid is CLAUDE_PID when set, else the Claude Code process that started
// this agent.
function currentRemoteUrl(): string | null {
  return readRemoteUrl({
    dir: join(homedir(), '.claude', 'sessions'),
    pid: process.env.CLAUDE_PID || process.ppid,
  })
}

// A suggestion's id: `<taskId>:<index>`, the line's position in the task's Suggested next list.
const SuggestionId = z
  .string()
  .regex(/^[A-Za-z0-9_-]+:(0|[1-9]\d*)$/)
  .transform((id) => {
    const at = id.lastIndexOf(':')
    return { id, taskId: id.slice(0, at), index: Number(id.slice(at + 1)) }
  })
// At most 50 at once: each id is a read, and one batch holds a write per source task.
const SuggestionIds = z.array(z.string()).max(50)
type SuggestionRef = z.infer<typeof SuggestionId>

export interface Suggestion {
  id: string
  text: string
}
// What retiring suggestions did: the ids retired, and each refused id with its reason.
export interface Retirement {
  retired: string[]
  refused: { id: string; reason: string }[]
}

// The longest answer kanban_answered_in_session takes.
const ANSWER_MAX_CHARS = 2000

export class BoardError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'BoardError'
  }
}

// ---- Phase 1 tool compatibility ------------------------------------------------
// The ten tools keep their shape in B1; these map their old vocabulary onto stage/needs.
// DESIGN.md Phase 2 package 2 replaces the mapping with the four-moment tools.

export type SubtaskStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'done' | 'skipped'
export const SUBTASK_STATUSES: readonly SubtaskStatus[] = [
  'pending',
  'in_progress',
  'awaiting_approval',
  'done',
  'skipped',
]
// kanban_update_task still accepts these two; every other Phase 1 status is retired.
export type UpdateStatus = 'in_progress' | 'done'
export const UPDATE_STATUSES: readonly UpdateStatus[] = ['in_progress', 'done']

// Step keys sessions used before stages existed.
const LEGACY_STEP_KEYS: Partial<Record<string, Stage>> = {
  spec_approved: 'approved',
  implement: 'build',
  pr_open: 'pr',
  reproduce: 'fix',
}
// The decision a stage waits on; finishing the stage clears a need of that kind.
const NEED_OF_STAGE: Partial<Record<Stage, NeedKind>> = {
  spec: 'spec',
  pr: 'pr',
  after_deploy: 'after_deploy',
}

function now() {
  return Date.now()
}

// The task's Suggested next lines. The summary is a session's text, so a stored value that is not
// a string has none.
function suggestionLines(task: Task): string[] {
  return typeof task.summary === 'string' ? suggestedNext(task.summary) : []
}

function asTask(snap: DocumentSnapshot): Task | null {
  return snap.exists ? taskOf(snap) : null
}
// Documents that come out of a query always exist.
function taskOf(snap: DocumentSnapshot): Task {
  return { ...(snap.data() as Omit<Task, 'id'>), id: snap.id }
}

export interface BoardIdentity {
  agentId: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
}

export class Board {
  readonly db: Firestore
  readonly id: BoardIdentity
  private heartbeat: NodeJS.Timeout | null = null
  // The remoteUrl last written to the agent document, so only a change is written.
  private remoteUrl: string | null = null

  constructor(cwd = process.cwd()) {
    this.db = getDb()
    const hostname = osHostname()
    this.id = {
      agentId: this.db.collection(C.agents).doc().id,
      projectId: projectIdFor(hostname, cwd),
      hostname,
      cwd,
      pid: process.pid,
    }
  }

  // ---- lifecycle ------------------------------------------------------------

  async register(): Promise<void> {
    const t = now()
    const { agentId, projectId, hostname, cwd, pid } = this.id
    const projectRef = this.db.collection(C.projects).doc(projectId)
    const forJamesRef = this.db.collection(C.tasks).doc(forJamesTaskId(projectId))
    const [projectSnap, forJamesSnap] = await this.db.getAll(projectRef, forJamesRef)

    const batch = this.db.batch()
    if (!projectSnap.exists) {
      const project: Omit<Project, 'id'> = {
        hostname,
        cwd,
        name: projectNameFor(cwd),
        createdAt: t,
        updatedAt: t,
      }
      batch.set(projectRef, project)
    } else {
      batch.update(projectRef, { updatedAt: t })
    }
    if (!forJamesSnap.exists) {
      const task = initialTaskFields({
        projectId,
        type: 'for_james',
        title: 'For James',
        description: 'Things James has to do by hand for this project.',
        createdBy: 'james',
        afterDeploy: [],
        now: t,
      })
      batch.set(forJamesRef, task)
    }
    const agent: Omit<AgentDoc, 'id'> = {
      projectId,
      hostname,
      cwd,
      pid,
      claudeSessionId: null,
      startedAt: t,
      lastSeen: t,
      remoteUrl: currentRemoteUrl(),
    }
    batch.set(this.agentRef(), agent)
    await batch.commit()
    this.remoteUrl = agent.remoteUrl ?? null
    setLogIdentity(agentId, projectId)

    this.heartbeat = setInterval(() => void this.beat(), AGENT_HEARTBEAT_MS)
    log(`registered agent=${agentId} project=${projectId} cwd=${cwd}`)
  }

  private agentRef() {
    return this.db.collection(C.agents).doc(this.id.agentId)
  }

  // Claims a change of the link: its new value when it differs from the one written (or being
  // written), else undefined. The value is recorded before the write, so an overlapping call or
  // heartbeat sees no change and writes nothing; release() hands it back after a failed write,
  // so the next call or heartbeat tries again.
  private claimRemoteUrl(): { remoteUrl: string | null; release: () => void } | undefined {
    const remoteUrl = currentRemoteUrl()
    const previous = this.remoteUrl
    if (remoteUrl === previous) return undefined
    this.remoteUrl = remoteUrl
    const release = () => {
      if (this.remoteUrl === remoteUrl) this.remoteUrl = previous
    }
    return { remoteUrl, release }
  }

  // One heartbeat: lastSeen, plus remoteUrl in the same write when the link changed.
  private async beat(): Promise<void> {
    const claim = this.claimRemoteUrl()
    try {
      await this.agentRef().update({
        lastSeen: now(),
        ...(claim ? { remoteUrl: claim.remoteUrl } : {}),
      })
    } catch (err) {
      claim?.release()
      firestoreFailure('WARNING', 'heartbeat failed', err as Error)
    }
  }

  // Re-reads the session's Claude-app link and writes remoteUrl only when it changed (back to
  // null too, when Remote Control goes off). Called on every kanban tool call; a failed write is
  // logged and retried on the next call or heartbeat, never failing the tool call.
  async refreshRemoteUrl(): Promise<void> {
    const claim = this.claimRemoteUrl()
    if (!claim) return
    try {
      await this.agentRef().update({ remoteUrl: claim.remoteUrl })
    } catch (err) {
      claim.release()
      firestoreFailure('WARNING', 'remoteUrl refresh failed', err as Error)
    }
  }

  // Mark this agent gone and its active tasks orphaned (agentId kept so a new
  // session can resume them with kanban_start_task).
  async shutdown(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    await orphanAgent(this.db, this.id.agentId)
  }

  // ---- reads ----------------------------------------------------------------

  async listTasks(stage?: Stage): Promise<Task[]> {
    let q = this.db.collection(C.tasks).where('projectId', '==', this.id.projectId)
    if (stage) q = q.where('stage', '==', stage)
    const snap = await q.orderBy('updatedAt', 'desc').limit(100).get()
    return snap.docs
      .map(taskOf)
      .sort((a, b) => listRank(a) - listRank(b) || b.updatedAt - a.updatedAt)
  }

  async getTask(taskId: string): Promise<Task> {
    const task = asTask(await this.db.collection(C.tasks).doc(taskId).get())
    if (!task) throw new BoardError(`no task ${taskId}`)
    if (task.projectId !== this.id.projectId)
      throw new BoardError(`task ${taskId} belongs to another project`)
    return task
  }

  // The open suggestions of a finished task still on the board (within DONE_VISIBLE_MS): its
  // Suggested next lines minus the retired ones, ids keeping each line's position. None for an
  // unfinished task.
  openSuggestions(task: Task): Suggestion[] {
    if (!isDone(task) || !isTaskVisible(task)) return []
    const retired = new Set(Array.isArray(task.retiredNext) ? task.retiredNext : [])
    return suggestionLines(task)
      .map((text, index) => ({ id: `${task.id}:${index}`, text }))
      .filter((_, index) => !retired.has(index))
  }

  async getComments(taskId: string, limit = 30): Promise<Comment[]> {
    const snap = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    return snap.docs.map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id })).reverse()
  }

  // ---- task writes ----------------------------------------------------------

  async createTask(input: { title: string; type: TaskType; description?: string }): Promise<Task> {
    if (!TASK_TYPES.includes(input.type) || input.type === 'for_james') {
      throw new BoardError(`type must be one of feature, bugfix, chore`)
    }
    const t = now()
    const ref = this.db.collection(C.tasks).doc()
    const task: Omit<Task, 'id'> = {
      ...initialTaskFields({
        projectId: this.id.projectId,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        createdBy: 'agent',
        afterDeploy: [],
        now: t,
      }),
      agentId: this.id.agentId,
      working: true,
    }
    await ref.set(task)
    log(`created task ${ref.id} "${task.title}"`)
    return { ...task, id: ref.id }
  }

  async startTask(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId)
    if (isDone(task)) throw new BoardError(`task ${taskId} is done; create a new one`)
    if (task.agentId && task.agentId !== this.id.agentId) {
      const other = (await this.db.collection(C.agents).doc(task.agentId).get()).data() as
        AgentDoc | undefined
      if (other && isAgentOnline(other)) {
        throw new BoardError(
          `task ${taskId} is being worked on by another live session (agent ${task.agentId}, pid ${other.pid})`
        )
      }
      log(`taking over task ${taskId} from stale agent ${task.agentId}`)
    }
    const t = now()
    const batch = this.db.batch()
    const bound = { agentId: this.id.agentId, working: true, updatedAt: t }
    batch.update(this.db.collection(C.tasks).doc(taskId), bound)
    // Route any undelivered comments on this task to us so our watcher prints them.
    const pending = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .where('deliveredAt', '==', null)
      .get()
    for (const d of pending.docs) {
      if (d.get('agentId') !== this.id.agentId) batch.update(d.ref, { agentId: this.id.agentId })
    }
    await batch.commit()
    log(`started task ${taskId} (${pending.size} pending comments rerouted)`)
    return { ...task, ...bound }
  }

  async updateTask(input: {
    task_id: string
    status?: UpdateStatus
    summary?: string
    pr_url?: string
    title?: string
    retire_suggestions?: string[]
  }): Promise<Task & { retirement?: Retirement }> {
    const task = await this.getTask(input.task_id)
    this.assertMine(task)
    if (input.status && !UPDATE_STATUSES.includes(input.status))
      throw new BoardError(`status must be one of ${UPDATE_STATUSES.join(', ')}`)
    // Before the task's own patch, so the suggestions retired are those of other finished tasks.
    const retirement =
      input.retire_suggestions === undefined
        ? undefined
        : await this.retireSuggestions(input.retire_suggestions)
    const t = now()
    const patch: Record<string, unknown> = { updatedAt: t }
    if (input.summary !== undefined) patch.summary = input.summary
    if (input.title) patch.title = input.title.trim()
    if (input.pr_url !== undefined) Object.assign(patch, prPatch(task, input.pr_url))
    if (input.status === 'in_progress') patch.needs = null
    if (input.status === 'done' && !isDone(task)) {
      // Finishing: the Done message and the unread mark go in the same batch as the done patch.
      Object.assign(patch, donePatch(t), { unread: true })
      await this.writeAgentComment(task, input.summary?.trim() || DONE_BODY, 'done', patch)
    } else {
      await this.db.collection(C.tasks).doc(task.id).update(patch)
    }
    log(`updated task ${task.id}: ${Object.keys(patch).join(',')}`)
    return { ...task, ...(patch as Partial<Task>), ...(retirement ? { retirement } : {}) }
  }

  // Marks suggestions as done by later work: each `<taskId>:<index>` of a finished task in this
  // project with a line at that index joins the task's retiredNext, one write per source task.
  // Every other id is refused with its reason and nothing is written for it.
  async retireSuggestions(ids: string[]): Promise<Retirement> {
    const list = SuggestionIds.safeParse(ids)
    if (!list.success) throw new BoardError('retire_suggestions must be an array of strings')
    const refused: Retirement['refused'] = []
    const bySource = new Map<string, SuggestionRef[]>()
    for (const id of new Set(list.data)) {
      const ref = SuggestionId.safeParse(id)
      if (!ref.success) {
        refused.push({ id, reason: 'not a suggestion id: expected <taskId>:<index>' })
        continue
      }
      bySource.set(ref.data.taskId, [...(bySource.get(ref.data.taskId) ?? []), ref.data])
    }
    const retired: string[] = []
    const refs = [...bySource.keys()].map((id) => this.db.collection(C.tasks).doc(id))
    const snaps = refs.length > 0 ? await this.db.getAll(...refs) : []
    const batch = this.db.batch()
    for (const snap of snaps) {
      const wanted = bySource.get(snap.id) ?? []
      const task = this.retirableSource(snap)
      if (typeof task === 'string') {
        for (const { id } of wanted) refused.push({ id, reason: task })
        continue
      }
      const count = suggestionLines(task).length
      const indices: number[] = []
      for (const { id, index } of wanted) {
        if (index < count) {
          retired.push(id)
          indices.push(index)
        } else {
          refused.push({
            id,
            reason: `task ${task.id} has ${count} suggestion(s), none at ${index}`,
          })
        }
      }
      if (indices.length > 0)
        batch.update(snap.ref, { retiredNext: FieldValue.arrayUnion(...indices) })
    }
    if (retired.length > 0) await batch.commit()
    log(`retired ${retired.length} suggestion(s), refused ${refused.length}`)
    return { retired, refused }
  }

  // The task whose suggestions may be retired, or why they may not.
  private retirableSource(snap: DocumentSnapshot): Task | string {
    const task = asTask(snap)
    if (!task) return `no task ${snap.id}`
    if (task.projectId !== this.id.projectId) return `task ${snap.id} belongs to another project`
    if (!isDone(task)) return `task ${snap.id} is not finished`
    return task
  }

  // Phase 1 step API: `key` is a stage name (or a retired step key) of the task's own chain.
  async setSubtask(
    taskId: string,
    key: string,
    status: SubtaskStatus,
    note?: string
  ): Promise<Task> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const t = now()
    const patch = { updatedAt: t, ...subtaskPatch(task, resolveStage(task, key), status) }
    if (note) await this.writeAgentComment(task, note, 'info', patch)
    else await this.db.collection(C.tasks).doc(taskId).update(patch)
    return { ...task, ...(patch as Partial<Task>) }
  }

  // ---- comments -------------------------------------------------------------

  async comment(taskId: string, body: string, kind: SessionCommentKind = 'info'): Promise<Comment> {
    const task = await this.getTask(taskId)
    if (task.type !== 'for_james') this.assertMine(task)
    return this.writeAgentComment(task, body, kind)
  }

  // James answered a question in the session's own chat: the question closes, the thread says so,
  // and his waiting board answers are marked so no watcher prints them. Plain comments still wait.
  async answeredInSession(taskId: string, answer: string): Promise<Comment> {
    const text = typeof answer === 'string' ? answer.trim() : ''
    if (text.length < 1 || text.length > ANSWER_MAX_CHARS)
      throw new BoardError(`invalid answer: 1 to ${ANSWER_MAX_CHARS} characters`)
    const task = await this.getTask(taskId)
    this.assertMine(task)
    if (task.needs?.kind !== 'question') throw new BoardError(`no open question on task ${taskId}`)
    const waiting = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .where('deliveredAt', '==', null)
      .get()
    const t = now()
    const c = await this.writeAgentComment(
      task,
      `James answered in the session: ${text}`,
      'info',
      { needs: null },
      (batch) => {
        for (const d of waiting.docs)
          if (d.get('author') === 'james' && d.get('kind') === 'answer')
            batch.update(d.ref, { deliveredAt: t })
      }
    )
    log(`answered in session on ${taskId}`)
    return c
  }

  // Red-checkpoint stub: options are accepted and not yet stored.
  async ask(taskId: string, question: string, _options?: string[]): Promise<Comment> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const needs: TaskNeed = { kind: 'question', question }
    const c = await this.writeAgentComment(task, question, 'question', { needs })
    log(`asked on ${taskId}: ${question.slice(0, 80)}`)
    return c
  }

  async todoForJames(body: string, link?: string, sourceTaskId?: string): Promise<Todo> {
    const t = now()
    const ref = this.db.collection(C.todos).doc()
    const todo: Omit<Todo, 'id'> = {
      projectId: this.id.projectId,
      body: body.trim(),
      link: link || null,
      done: false,
      sourceTaskId: sourceTaskId ?? null,
      createdAt: t,
      doneAt: null,
    }
    await ref.set(todo)
    const forJames = await this.getTask(forJamesTaskId(this.id.projectId))
    await this.writeAgentComment(
      forJames,
      `New to-do: ${todo.body}${link ? ` (${link})` : ''}`,
      'system'
    )
    log(`todo for james: ${todo.body}`)
    return { ...todo, id: ref.id }
  }

  private async writeAgentComment(
    task: Task,
    body: string,
    kind: SessionCommentKind,
    taskPatch: Record<string, unknown> = {},
    alsoInBatch: (batch: WriteBatch) => void = () => {}
  ): Promise<Comment> {
    const t = now()
    const ref = this.db.collection(C.comments).doc()
    const c: Omit<Comment, 'id'> = {
      taskId: task.id,
      projectId: task.projectId,
      agentId: this.id.agentId,
      author: 'agent',
      kind,
      body: body.trim(),
      createdAt: t,
      deliveredAt: t, // our own words never come back to us
      workingAt: null,
      handledAt: null,
    }
    const batch = this.db.batch()
    batch.set(ref, c)
    batch.update(this.db.collection(C.tasks).doc(task.id), {
      lastCommentAt: t,
      updatedAt: t,
      ...taskPatch,
    })
    alsoInBatch(batch)
    await batch.commit()
    return { ...c, id: ref.id }
  }

  // ---- inbound --------------------------------------------------------------

  // Streams tasks James queues from the board for this project (including ones queued
  // before this session started) so an idle session can pick them up. Each task is
  // announced once per session; binding is still an explicit kanban_start_task. Queued is
  // derived (first stage, no agent): the query narrows to unbound tasks, isQueued decides.
  listenForQueued(announce: (t: Task) => Promise<void>): () => void {
    const announced = new Set<string>()
    const q = this.db
      .collection(C.tasks)
      .where('projectId', '==', this.id.projectId)
      .where('agentId', '==', null)
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const t = taskOf(change.doc)
        if (!isQueued(t) || announced.has(t.id)) continue
        announced.add(t.id)
        try {
          await announce(t)
          log(`announced queued task ${t.id} "${t.title}"`)
        } catch (err) {
          announced.delete(t.id)
          firestoreFailure('WARNING', `announce of ${t.id} failed`, err as Error, t.id)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) =>
          firestoreFailure('WARNING', `queued batch failed`, err)
        )
      },
      (err) => firestoreFailure('ERROR', 'queued listener error', err)
    )
  }

  private assertMine(task: Task) {
    if (task.agentId !== this.id.agentId) {
      throw new BoardError(
        `task ${task.id} is not bound to this session; call kanban_start_task first`
      )
    }
  }
}

// A reply clears the task's question when it answers it, or arrives while the task asks one.
function clearsQuestion(c: Comment, task: Task): boolean {
  return c.kind === 'answer' || task.needs?.kind === 'question'
}

// A watcher's claim on James's waiting replies, in one transaction: each reply whose deliveredAt
// is still unset and that still belongs to `agentId` (kanban_start_task may have rerouted it) gets
// marked received and its task's question settled; the rest were claimed by another watcher or
// moved to another session and are left out. Returns the claimed replies, oldest first.
export async function claimReplies(
  db: Firestore,
  agentId: string,
  ids: readonly string[]
): Promise<Comment[]> {
  return db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...ids.map((id) => db.collection(C.comments).doc(id)))
    const claimed = snaps
      .filter(
        (s) =>
          s.exists &&
          s.get('deliveredAt') === null &&
          s.get('author') === 'james' &&
          s.get('agentId') === agentId
      )
      .map((s) => ({ ...(s.data() as Omit<Comment, 'id'>), id: s.id }))
      .sort((a, b) => a.createdAt - b.createdAt)
    const taskIds = [...new Set(claimed.map((c) => c.taskId))]
    const tasks = new Map<string, Task | null>()
    if (taskIds.length > 0) {
      const taskSnaps = await tx.getAll(...taskIds.map((id) => db.collection(C.tasks).doc(id)))
      for (const s of taskSnaps) tasks.set(s.id, asTask(s))
    }
    const t = now()
    const settled = new Set<string>()
    for (const c of claimed) {
      tx.update(db.collection(C.comments).doc(c.id), { deliveredAt: t })
      const task = tasks.get(c.taskId)
      if (task && clearsQuestion(c, task)) settled.add(c.taskId)
    }
    for (const [id, task] of tasks) {
      if (!task) continue
      const patch = settled.has(id) ? { updatedAt: t, needs: null } : { updatedAt: t }
      tx.update(db.collection(C.tasks).doc(id), patch)
    }
    return claimed
  })
}

// Shared by Board.shutdown and the SessionEnd hook. The agent goes offline and its tasks stop
// being worked on; agentId stays so a new session can resume them with kanban_start_task.
export async function orphanAgent(db: Firestore, agentId: string): Promise<number> {
  const batch: WriteBatch = db.batch()
  batch.update(db.collection(C.agents).doc(agentId), { lastSeen: 0 })
  const active = await db
    .collection(C.tasks)
    .where('agentId', '==', agentId)
    .where('working', '==', true)
    .get()
  const t = now()
  for (const d of active.docs) batch.update(d.ref, { working: false, updatedAt: t })
  await batch.commit()
  log(`agent ${agentId} shut down; ${active.size} task(s) orphaned`)
  return active.size
}

// Most recent live agent for (hostname, cwd): how hooks find "their" session.
export async function findLiveAgent(
  db: Firestore,
  hostname: string,
  cwd: string
): Promise<(AgentDoc & { id: string }) | null> {
  const snap = await db
    .collection(C.agents)
    .where('hostname', '==', hostname)
    .where('cwd', '==', cwd)
    .get()
  const live = snap.docs
    .map((d) => ({ ...(d.data() as Omit<AgentDoc, 'id'>), id: d.id }))
    .filter((a) => isAgentOnline(a))
    .sort((a, b) => b.startedAt - a.startedAt)
  return live[0] ?? null
}

// Order in kanban_list_tasks: the pinned For James task, then what needs James, then work in
// flight, then queued, then done.
const PHASE_RANK: Record<TaskPhase, number> = {
  waiting_on_james: 0,
  in_progress: 1,
  queued: 2,
  done: 3,
}
function listRank(t: Task): number {
  return t.type === 'for_james' ? -1 : PHASE_RANK[taskPhase(t)]
}

// A step key from the tool is a stage of this task's chain, or a retired Phase 1 step key.
function resolveStage(task: Task, key: string): Stage {
  const wanted = LEGACY_STEP_KEYS[key] ?? key
  const stage = taskStages(task).find((s) => s === wanted)
  if (!stage) {
    const has = taskStages(task).join(', ') || 'none'
    throw new BoardError(`task ${task.id} has no step "${key}" (has: ${has})`)
  }
  return stage
}

// Finishing a task: done, stamped, unbound, nothing left for James to decide.
function donePatch(t: number): Record<string, unknown> {
  return { stage: 'done', doneAt: t, agentId: null, needs: null, working: false }
}

// The Done message's body when the session gives no summary.
const DONE_BODY = 'Done.'

// The stages in which a reported PR is the work's result, so the task then waits on James's
// merge decision: build (fix for a bugfix, do for a chore) and pr itself.
const PR_READY_FROM: readonly Stage[] = ['build', 'fix', 'do', 'pr']

// pr_url sets the PR (its number is the last number in the URL). From a build stage or pr it
// also moves the task to pr and makes it wait on James's merge; at an earlier or later stage it
// only records the PR. An empty url clears it.
function prPatch(task: Task, url: string): Record<string, unknown> {
  if (!url) return { pr: null }
  const number = /(\d+)\/?(?:[?#].*)?$/.exec(url)?.[1]
  if (!number) throw new BoardError('pr_url must end in the pull request number')
  const pr = { pr: { number: Number(number), url } }
  const ready = PR_READY_FROM.includes(task.stage) && taskStages(task).includes('pr')
  return ready ? { ...pr, stage: 'pr', needs: { kind: 'pr' } satisfies TaskNeed } : pr
}

// Moves the task past `stage`: to the next stage of its chain, clearing the need of any stage it
// passes on the way (its current stage through `stage`). A task already beyond `stage` is left
// alone. Never finishes a task: that is kanban_update_task with status "done" and a summary, the
// only call that posts the Done message, so the stage before done (and done itself) is refused.
function advancePast(task: Task, stage: Stage): Record<string, unknown> {
  const chain = taskStages(task)
  const next = chain.at(chain.indexOf(stage) + 1)
  if (next === undefined || next === 'done')
    throw new BoardError(
      `kanban_subtask does not finish a task: to finish task ${task.id}, call kanban_update_task with status "done" and a summary`
    )
  if (chain.indexOf(task.stage) > chain.indexOf(stage)) return {}
  const passed = chain.slice(Math.max(0, chain.indexOf(task.stage)), chain.indexOf(stage) + 1)
  const needKind = task.needs?.kind
  const stale = needKind !== undefined && passed.some((s) => NEED_OF_STAGE[s] === needKind)
  return { stage: next, ...(stale ? { needs: null } : {}) }
}

// What kanban_subtask changes on the task for each Phase 1 step status.
function subtaskPatch(task: Task, stage: Stage, status: SubtaskStatus): Record<string, unknown> {
  switch (status) {
    case 'awaiting_approval':
      if (stage !== 'spec') throw new BoardError('awaiting_approval only applies to the spec step')
      return { needs: { kind: 'spec' } satisfies TaskNeed }
    case 'done':
    case 'skipped':
      return advancePast(task, stage)
    case 'in_progress': {
      const chain = taskStages(task)
      const ahead = stage !== 'done' && chain.indexOf(stage) > chain.indexOf(task.stage)
      return ahead ? { stage } : {}
    }
    case 'pending':
      return {}
  }
}

export { FieldValue }

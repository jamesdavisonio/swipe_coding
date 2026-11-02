// All Firestore reads/writes for one agent (= one Claude Code session).
import { hostname as osHostname } from 'node:os'
import {
  FieldValue,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
  type WriteBatch,
} from 'firebase-admin/firestore'
import {
  AGENT_HEARTBEAT_MS,
  COLLECTIONS as C,
  TASK_STATUSES,
  TASK_TYPES,
  forJamesTaskId,
  isAgentOnline,
  projectIdFor,
  projectNameFor,
  subtasksFor,
  type AgentDoc,
  type Comment,
  type CommentKind,
  type Project,
  type Subtask,
  type SubtaskStatus,
  type Task,
  type TaskStatus,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { getDb, log } from './firestore.ts'

export class BoardError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'BoardError'
  }
}

const OPEN_STATUSES: TaskStatus[] = [
  'waiting_on_james',
  'blocked_on_permission',
  'in_progress',
  'queued',
  'orphaned',
]
const ACTIVE_STATUSES: TaskStatus[] = ['in_progress', 'waiting_on_james', 'blocked_on_permission']

function now() {
  return Date.now()
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
      const task: Omit<Task, 'id'> = {
        projectId,
        agentId: null,
        type: 'for_james',
        title: 'For James',
        description: 'Things James has to do by hand for this project.',
        status: 'in_progress',
        summary: '',
        prUrl: null,
        branch: null,
        createdBy: 'james',
        createdAt: t,
        updatedAt: t,
        subtasks: [],
        openQuestion: null,
        lastCommentAt: null,
      }
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
    }
    batch.set(this.db.collection(C.agents).doc(agentId), agent)
    await batch.commit()

    this.heartbeat = setInterval(() => {
      this.db
        .collection(C.agents)
        .doc(agentId)
        .update({ lastSeen: now() })
        .catch((err: Error) => log(`heartbeat failed: ${err.message}`))
    }, AGENT_HEARTBEAT_MS)
    log(`registered agent=${agentId} project=${projectId} cwd=${cwd}`)
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

  async listTasks(status?: TaskStatus): Promise<Task[]> {
    let q = this.db.collection(C.tasks).where('projectId', '==', this.id.projectId)
    if (status) q = q.where('status', '==', status)
    const snap = await q.orderBy('updatedAt', 'desc').limit(100).get()
    const tasks = snap.docs.map(taskOf)
    const rank = (t: Task) =>
      t.type === 'for_james'
        ? -1
        : OPEN_STATUSES.indexOf(t.status) === -1
          ? 99
          : OPEN_STATUSES.indexOf(t.status)
    return tasks.sort((a, b) => rank(a) - rank(b) || b.updatedAt - a.updatedAt)
  }

  async getTask(taskId: string): Promise<Task> {
    const task = asTask(await this.db.collection(C.tasks).doc(taskId).get())
    if (!task) throw new BoardError(`no task ${taskId}`)
    if (task.projectId !== this.id.projectId)
      throw new BoardError(`task ${taskId} belongs to another project`)
    return task
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
      projectId: this.id.projectId,
      agentId: this.id.agentId,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: 'in_progress',
      summary: '',
      prUrl: null,
      branch: null,
      createdBy: 'agent',
      createdAt: t,
      updatedAt: t,
      subtasks: subtasksFor(input.type),
      openQuestion: null,
      lastCommentAt: null,
    }
    await ref.set(task)
    log(`created task ${ref.id} "${task.title}"`)
    return { ...task, id: ref.id }
  }

  async startTask(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId)
    if (task.status === 'done') throw new BoardError(`task ${taskId} is done; create a new one`)
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
    const status: TaskStatus = task.openQuestion ? 'waiting_on_james' : 'in_progress'
    batch.update(this.db.collection(C.tasks).doc(taskId), {
      agentId: this.id.agentId,
      status,
      updatedAt: t,
    })
    // Route any undelivered comments on this task to us so they flow through the listener.
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
    return { ...task, agentId: this.id.agentId, status, updatedAt: t }
  }

  async updateTask(input: {
    task_id: string
    status?: TaskStatus
    summary?: string
    pr_url?: string
    branch?: string
    title?: string
  }): Promise<Task> {
    const task = await this.getTask(input.task_id)
    this.assertMine(task)
    if (input.status && !TASK_STATUSES.includes(input.status))
      throw new BoardError(`bad status ${input.status}`)
    const t = now()
    const patch: Record<string, unknown> = { updatedAt: t }
    if (input.status) patch.status = input.status
    if (input.summary !== undefined) patch.summary = input.summary
    if (input.pr_url !== undefined) patch.prUrl = input.pr_url || null
    if (input.branch !== undefined) patch.branch = input.branch || null
    if (input.title) patch.title = input.title.trim()
    let subtasks = task.subtasks
    if (input.pr_url) subtasks = setSubtask(subtasks, 'pr_open', 'done')
    if (input.status === 'done') {
      patch.agentId = null
      patch.openQuestion = null
      subtasks = setSubtask(subtasks, 'done', 'done')
    }
    if (subtasks !== task.subtasks) patch.subtasks = subtasks
    await this.db.collection(C.tasks).doc(task.id).update(patch)
    log(`updated task ${task.id}: ${Object.keys(patch).join(',')}`)
    return { ...task, ...(patch as Partial<Task>) }
  }

  async setSubtask(
    taskId: string,
    key: string,
    status: SubtaskStatus,
    note?: string
  ): Promise<Subtask[]> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    if (!task.subtasks.some((s) => s.key === key)) {
      throw new BoardError(
        `task ${taskId} has no subtask "${key}" (has: ${task.subtasks.map((s) => s.key).join(', ') || 'none'})`
      )
    }
    const subtasks = setSubtask(task.subtasks, key, status, note)
    await this.db.collection(C.tasks).doc(taskId).update({ subtasks, updatedAt: now() })
    return subtasks
  }

  // ---- comments -------------------------------------------------------------

  async comment(taskId: string, body: string, kind: CommentKind = 'comment'): Promise<Comment> {
    const task = await this.getTask(taskId)
    if (task.type !== 'for_james') this.assertMine(task)
    return this.writeAgentComment(task, body, kind)
  }

  async ask(taskId: string, question: string): Promise<Comment> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const c = await this.writeAgentComment(task, question, 'question', {
      openQuestion: question,
      status: 'waiting_on_james',
    })
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
    kind: CommentKind,
    taskPatch: Record<string, unknown> = {}
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
    }
    const batch = this.db.batch()
    batch.set(ref, c)
    batch.update(this.db.collection(C.tasks).doc(task.id), {
      lastCommentAt: t,
      updatedAt: t,
      ...taskPatch,
    })
    await batch.commit()
    return { ...c, id: ref.id }
  }

  // ---- inbound --------------------------------------------------------------

  // Streams James's undelivered comments for tasks bound to this agent. `deliver`
  // must push the event into the session; once it resolves we mark delivery and
  // move the task out of waiting_on_james.
  listenForJames(deliver: (c: Comment) => Promise<void>): () => void {
    const inflight = new Set<string>()
    const q = this.db
      .collection(C.comments)
      .where('agentId', '==', this.id.agentId)
      .where('deliveredAt', '==', null)
      .orderBy('createdAt', 'asc')
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const c: Comment = { ...(change.doc.data() as Omit<Comment, 'id'>), id: change.doc.id }
        if (c.author !== 'james' || inflight.has(c.id)) continue
        inflight.add(c.id)
        try {
          await deliver(c)
          await this.markDelivered(c)
          log(`delivered ${c.id} (${c.kind}) task=${c.taskId}`)
        } catch (err) {
          log(`delivery of ${c.id} failed: ${(err as Error).message}`)
        } finally {
          inflight.delete(c.id)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) => log(`comment batch failed: ${err.message}`))
      },
      (err) => log(`comment listener error: ${err.message}`)
    )
  }

  // Streams tasks James queues from the board for this project (including ones queued
  // before this session started) so an idle session can pick them up. Each task is
  // announced once per session; binding is still an explicit kanban_start_task.
  listenForQueued(announce: (t: Task) => Promise<void>): () => void {
    const announced = new Set<string>()
    const q = this.db
      .collection(C.tasks)
      .where('projectId', '==', this.id.projectId)
      .where('status', '==', 'queued')
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const t = taskOf(change.doc)
        if (t.agentId || announced.has(t.id)) continue
        announced.add(t.id)
        try {
          await announce(t)
          log(`announced queued task ${t.id} "${t.title}"`)
        } catch (err) {
          announced.delete(t.id)
          log(`announce of ${t.id} failed: ${(err as Error).message}`)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) => log(`queued batch failed: ${err.message}`))
      },
      (err) => log(`queued listener error: ${err.message}`)
    )
  }

  private async markDelivered(c: Comment): Promise<void> {
    const t = now()
    const taskRef = this.db.collection(C.tasks).doc(c.taskId)
    await this.db.runTransaction(async (tx) => {
      const task = asTask(await tx.get(taskRef))
      tx.update(this.db.collection(C.comments).doc(c.id), { deliveredAt: t })
      if (!task) return
      const patch: Record<string, unknown> = { updatedAt: t }
      if (c.kind === 'answer' || task.openQuestion) patch.openQuestion = null
      if (task.status === 'waiting_on_james') patch.status = 'in_progress'
      tx.update(taskRef, patch)
    })
  }

  private assertMine(task: Task) {
    if (task.agentId !== this.id.agentId) {
      throw new BoardError(
        `task ${task.id} is not bound to this session; call kanban_start_task first`
      )
    }
  }
}

// Shared by Board.shutdown and the SessionEnd hook.
export async function orphanAgent(db: Firestore, agentId: string): Promise<number> {
  const batch: WriteBatch = db.batch()
  batch.update(db.collection(C.agents).doc(agentId), { lastSeen: 0 })
  const active = await db
    .collection(C.tasks)
    .where('agentId', '==', agentId)
    .where('status', 'in', ACTIVE_STATUSES)
    .get()
  const t = now()
  for (const d of active.docs) batch.update(d.ref, { status: 'orphaned', updatedAt: t })
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

function setSubtask(
  subtasks: Subtask[],
  key: string,
  status: SubtaskStatus,
  note?: string
): Subtask[] {
  if (!subtasks.some((s) => s.key === key)) return subtasks
  return subtasks.map((s) =>
    s.key === key ? { ...s, status, ...(note !== undefined ? { note } : {}) } : s
  )
}

export { FieldValue }

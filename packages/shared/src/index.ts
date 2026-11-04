// Shared types for the kanban board. Plain TypeScript, no enums/namespaces:
// Node 24 runs this file directly with type stripping, and Vite bundles it for the web.
//
// Firestore layout (all top-level collections, numeric ms timestamps):
//   projects/{projectId}   agents/{agentId}   tasks/{taskId}   comments/{commentId}   todos/{todoId}

// Both addresses are James; Google reports whichever is primary on the signed-in account.
export const OWNER_EMAILS: readonly string[] = ['j@nullnoise.ai', 'james@nullnoise.ai']
export const OWNER_EMAIL = OWNER_EMAILS[0]
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email.toLowerCase())
}

import { stagesFor } from './templates.ts'

export const COLLECTIONS = {
  projects: 'projects',
  agents: 'agents',
  tasks: 'tasks',
  comments: 'comments',
  todos: 'todos',
} as const

export type Author = 'james' | 'agent'

export type TaskType = 'feature' | 'bugfix' | 'chore' | 'for_james'
export const TASK_TYPES: readonly TaskType[] = ['feature', 'bugfix', 'chore', 'for_james']

// A task moves along a fixed chain of stages per type (see stagesFor in templates.ts).
export type Stage =
  | 'spec'
  | 'approved'
  | 'build'
  | 'fix'
  | 'do'
  | 'pr'
  | 'merged'
  | 'main_ci'
  | 'after_deploy'
  | 'done'

export const STAGES: readonly Stage[] = [
  'spec',
  'approved',
  'build',
  'fix',
  'do',
  'pr',
  'merged',
  'main_ci',
  'after_deploy',
  'done',
]

// What James has to decide right now; the session sets it, his decision clears it.
export type NeedKind = 'spec' | 'question' | 'pr' | 'after_deploy'
export interface TaskNeed {
  kind: NeedKind
  question?: string
  options?: { key: string; label: string }[]
}

export interface TaskSpec {
  goal: string
  points: string[]
  out: string
  touches: string
  version: number
}

export interface TaskPr {
  number: number
  url: string
}

export type LogWho = 'james' | 'session' | 'system'
export interface LogEntry {
  at: number
  who: LogWho
  text: string
}

// Comments split by author: James writes the first six kinds, the session the other seven.
export const JAMES_COMMENT_KINDS = [
  'comment',
  'answer',
  'approve',
  'change_request',
  'merged',
  'reopen',
] as const
export type JamesCommentKind = (typeof JAMES_COMMENT_KINDS)[number]
export const SESSION_COMMENT_KINDS = [
  'spec',
  'question',
  'pr',
  'after_deploy',
  'done',
  'info',
  'system',
] as const
export type SessionCommentKind = (typeof SESSION_COMMENT_KINDS)[number]
export type CommentKind = JamesCommentKind | SessionCommentKind
export interface Project {
  id: string
  hostname: string
  cwd: string
  name: string // basename of cwd by default; editable in the UI
  createdAt: number
  updatedAt: number
}

export interface AgentDoc {
  id: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
  claudeSessionId: string | null // filled by the SessionStart hook when known
  startedAt: number
  lastSeen: number // heartbeat; online = now - lastSeen < AGENT_STALE_MS
}
// One heartbeat write per agent every five minutes keeps a fleet of always-on agents well
// inside Firestore's free daily write quota (30 s beats drained it on 2026-11-04). Stale is
// two missed beats plus margin, so a running session stays live throughout; the trade-off is
// that the live dot may lag a closed session by up to twelve minutes.
export const AGENT_HEARTBEAT_MS = 5 * 60 * 1000
export const AGENT_STALE_MS = 12 * 60 * 1000

export interface Task {
  id: string
  projectId: string
  agentId: string | null // the session currently bound to this task
  type: TaskType
  title: string
  description: string
  stage: Stage
  needs: TaskNeed | null // null (never absent) once James has decided
  spec: TaskSpec | null
  afterDeploy: string[] // steps James does by hand once merged and green
  afterDone: boolean[] // his ticks, parallel to afterDeploy
  pr: TaskPr | null
  summary: string // the session's running summary / final report
  createdBy: Author
  createdAt: number
  updatedAt: number
  doneAt: number | null
  reopenedAt: number | null
  unread: boolean // set by the session, cleared when James opens the thread
  working: boolean // the session is on it right now
  lastCommentAt: number | null
  log: LogEntry[] // decision history, append-only, capped at LOG_CAP (see appendLog)
}

export interface Comment {
  id: string
  taskId: string
  projectId: string
  agentId: string | null // denormalised from the task at write time; routing key for delivery
  author: Author
  kind: CommentKind
  body: string
  createdAt: number
  deliveredAt: number | null // null until the bound agent has pushed it into its session
  workingAt: number | null // agent-written: the session started on it (absent on older documents)
  handledAt: number | null // agent-written: the session answered it (absent on older documents)
}

export interface Todo {
  id: string
  projectId: string
  body: string
  link: string | null
  done: boolean
  sourceTaskId: string | null
  createdAt: number
  doneAt: number | null
}

// Deterministic project id from (hostname, cwd) so every agent on a machine agrees
// without a lookup. FNV-1a over the normalised path, plus a readable prefix.
export function projectIdFor(hostname: string, cwd: string): string {
  const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const base = norm.split('/').filter(Boolean).pop() ?? 'root'
  const slug =
    base
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'project'
  let h = 0x811c9dc5
  for (const ch of `${hostname.toLowerCase()}:${norm}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${slug}-${h.toString(16).padStart(8, '0')}`
}

export function projectNameFor(cwd: string): string {
  const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  return norm.split('/').filter(Boolean).pop() ?? cwd
}

export function isAgentOnline(agent: Pick<AgentDoc, 'lastSeen'>, now = Date.now()): boolean {
  return now - agent.lastSeen < AGENT_STALE_MS
}

// ---- stage model helpers (pure) ---------------------------------------------------

// Done tasks leave the lists this long after `doneAt`; nothing is deleted.
export const DONE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000
// The task's decision log keeps this many entries; the oldest move to tasks/{id}/log_archive.
export const LOG_CAP = 200
// A for_james task has no stage chain; it rests at this stage.
const FOR_JAMES_STAGE: Stage = 'do'

type StageShape = Pick<Task, 'type' | 'afterDeploy' | 'stage'>

export function isDone(task: Pick<Task, 'stage'>): boolean {
  return task.stage === 'done'
}

export function isTaskVisible(
  task: Pick<Task, 'stage' | 'doneAt'>,
  opts: { now?: number; showOlder?: boolean } = {}
): boolean {
  const { now = Date.now(), showOlder = false } = opts
  if (!isDone(task) || showOlder || task.doneAt === null) return true
  return now - task.doneAt <= DONE_VISIBLE_MS
}

// The task's own stage list (after_deploy is in it only when the task has steps).
export function taskStages(task: Pick<Task, 'type' | 'afterDeploy'>): Stage[] {
  return stagesFor(task.type, task.afterDeploy.length > 0)
}

// Position in the task's own stage list; -1 when the stage is not in it.
export function stageIndex(task: StageShape): number {
  return taskStages(task).indexOf(task.stage)
}

// Queued = still at the first stage and not yet bound to a session.
export function isQueued(task: StageShape & Pick<Task, 'agentId'>): boolean {
  return task.agentId === null && task.stage === taskStages(task)[0]
}

// The one classification both the agent's list order and the web's status words use.
export type TaskPhase = 'waiting_on_james' | 'done' | 'queued' | 'in_progress'

export function taskPhase(task: StageShape & Pick<Task, 'agentId' | 'needs'>): TaskPhase {
  if (task.needs) return 'waiting_on_james'
  if (isDone(task)) return 'done'
  return isQueued(task) ? 'queued' : 'in_progress'
}

// Appends one entry and returns the new log (the newest LOG_CAP entries) plus the overflow,
// oldest first, for the caller to move into tasks/{id}/log_archive. Never mutates its input.
export function appendLog(
  log: readonly LogEntry[],
  entry: LogEntry
): { log: LogEntry[]; archived: LogEntry[] } {
  const all = [...log, entry]
  const overflow = Math.max(0, all.length - LOG_CAP)
  return { log: all.slice(overflow), archived: all.slice(0, overflow) }
}

export type DeliveryState = 'sent' | 'delivered' | 'working' | 'handled'

// Tick state of one of James's comments from the agent's stamps. The latest stamp wins even
// when an earlier one is missing, so it never goes backwards; absent fields read like null.
export function deliveryState(
  c: Pick<Comment, 'deliveredAt' | 'workingAt' | 'handledAt'>
): DeliveryState {
  if (c.handledAt != null) return 'handled'
  if (c.workingAt != null) return 'working'
  if (c.deliveredAt != null) return 'delivered'
  return 'sent'
}

// Every field of a freshly created task, in the one shape both web and agent write.
export function initialTaskFields(input: {
  projectId: string
  type: TaskType
  title: string
  description: string
  createdBy: Author
  afterDeploy: string[]
  now: number
}): Omit<Task, 'id'> {
  return {
    projectId: input.projectId,
    agentId: null,
    type: input.type,
    title: input.title,
    description: input.description,
    stage: stagesFor(input.type, input.afterDeploy.length > 0)[0] ?? FOR_JAMES_STAGE,
    needs: null,
    spec: null,
    afterDeploy: input.afterDeploy,
    afterDone: input.afterDeploy.map(() => false),
    pr: null,
    summary: '',
    createdBy: input.createdBy,
    createdAt: input.now,
    updatedAt: input.now,
    doneAt: null,
    reopenedAt: null,
    unread: false,
    working: false,
    lastCommentAt: null,
    log: [],
  }
}

export * from './templates.ts'

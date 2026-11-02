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

export type TaskStatus =
  | 'queued'
  | 'in_progress'
  | 'waiting_on_james'
  | 'blocked_on_permission'
  | 'done'
  | 'orphaned'
export const TASK_STATUSES: readonly TaskStatus[] = [
  'queued', 'in_progress', 'waiting_on_james', 'blocked_on_permission', 'done', 'orphaned',
]

export type SubtaskStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'done' | 'skipped'

export type CommentKind = 'comment' | 'question' | 'answer' | 'system'

export interface Subtask {
  key: string
  label: string
  status: SubtaskStatus
  note?: string
}

export interface Project {
  id: string
  hostname: string
  cwd: string
  name: string          // basename of cwd by default; editable in the UI
  createdAt: number
  updatedAt: number
}

export interface AgentDoc {
  id: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
  claudeSessionId: string | null   // filled by the SessionStart hook when known
  startedAt: number
  lastSeen: number                 // heartbeat; online = now - lastSeen < AGENT_STALE_MS
}
export const AGENT_HEARTBEAT_MS = 30_000
export const AGENT_STALE_MS = 90_000

export interface Task {
  id: string
  projectId: string
  agentId: string | null           // the session currently bound to this task
  type: TaskType
  title: string
  description: string
  status: TaskStatus
  summary: string                  // the session's running summary / final report
  prUrl: string | null
  branch: string | null
  createdBy: Author
  createdAt: number
  updatedAt: number
  subtasks: Subtask[]
  openQuestion: string | null      // set by kanban_ask, cleared when James answers
  lastCommentAt: number | null
}

export interface Comment {
  id: string
  taskId: string
  projectId: string
  agentId: string | null           // denormalised from the task at write time; routing key for delivery
  author: Author
  kind: CommentKind
  body: string
  createdAt: number
  deliveredAt: number | null       // null until the bound agent has pushed it into its session
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
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'project'
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

export * from './templates.ts'

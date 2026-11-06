// Shared setup for the board-replies-anywhere R1 suites (tests/emulator/board-replies-anywhere-r1-*):
// the watcher (packages/agent/src/wait.ts) and the real agent, each spawned over stdio against the
// Firestore emulator, with the board seeded and read back through the agent's own admin db. Run
// with `npm run test:rules` (emulators:exec sets FIRESTORE_EMULATOR_HOST; project demo-kanban).
// Never against a live project: every child gets KANBAN_SA pointed at this file (it exists but is
// not a key), so the key lookup stops there, and KANBAN_TEST_LIVE is removed.
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, afterEach, beforeAll } from 'vitest'
import {
  initialTaskFields,
  type AgentDoc,
  type Comment,
  type JamesCommentKind,
  type Task,
  type TaskNeed,
} from '../../packages/shared/src/index.ts'

const ROOT = join(import.meta.dirname, '..', '..')
export const WAIT_TS = join(ROOT, 'packages', 'agent', 'src', 'wait.ts')
const AGENT_TS = join(ROOT, 'packages', 'agent', 'src', 'index.ts')
export const QUESTION: TaskNeed = { kind: 'question', question: 'Which branch should this go to?' }

// The emulator env startAgent builds; `offline` drops the emulator too, so the board is offline.
function childEnv(offline = false): NodeJS.ProcessEnv {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('run through npm run test:rules')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_PROJECT_ID: 'demo-kanban',
    KANBAN_SA: fileURLToPath(import.meta.url),
  }
  delete env.KANBAN_TEST_LIVE
  delete env.APP_ENV
  if (offline) delete env.FIRESTORE_EMULATOR_HOST
  return env
}

const live = new Set<ChildProcess>()
const tmp = (what: string) => mkdtempSync(join(tmpdir(), `replies-r1-${what}-`))

// The agent's admin db (emulator mode) for the file; leftover children are killed after each test.
export function useBoardDb(): () => Firestore {
  let db: Firestore | null = null
  beforeAll(async () => {
    db = (await import('../../packages/agent/src/firestore.ts')).getDb()
  })
  afterEach(() => {
    for (const child of live) child.kill()
    live.clear()
  })
  return () => {
    if (!db) throw new Error('useBoardDb() has not opened the emulator')
    return db
  }
}

// ---- seeding the board ----------------------------------------------------------------------

export interface Session {
  agentId: string
  projectId: string
}
let clock = 0
const tick = () => (clock = Math.max(Date.now(), clock + 1))

// A session as the board knows it: an agents document (live unless `lastSeen` says otherwise).
export async function seedSession(db: Firestore, fields: Partial<AgentDoc> = {}): Promise<Session> {
  const ref = db.collection('agents').doc()
  const t = Date.now()
  const agent: Omit<AgentDoc, 'id'> = {
    projectId: `replies-r1-${ref.id.toLowerCase()}`,
    hostname: 'replies-r1-host',
    cwd: `/tmp/replies-r1-${ref.id}`,
    pid: 1,
    claudeSessionId: null,
    startedAt: t,
    lastSeen: t,
    ...fields,
  }
  await ref.set(agent)
  return { agentId: ref.id, projectId: agent.projectId }
}

// A feature task bound to `s` (or unbound when its agentId is null), then set to `fields`.
export async function seedTask(
  db: Firestore,
  s: { agentId: string | null; projectId: string },
  fields: Partial<Omit<Task, 'id'>> = {}
): Promise<Task> {
  const ref = db.collection('tasks').doc()
  const task: Omit<Task, 'id'> = {
    ...initialTaskFields({
      projectId: s.projectId,
      type: 'feature',
      title: `R1 ${ref.id}`,
      description: '',
      createdBy: 'agent',
      afterDeploy: [],
      now: Date.now(),
    }),
    agentId: s.agentId,
    working: s.agentId !== null,
    ...fields,
  }
  await ref.set(task)
  return { ...task, id: ref.id }
}

// James's reply as the phone writes it (lib/messages.ts jamesComment): routed to the task's
// session, unmarked. createdAt grows strictly from one call to the next.
export async function postReply(
  db: Firestore,
  task: Pick<Task, 'id' | 'projectId' | 'agentId'>,
  kind: JamesCommentKind,
  body: string,
  createdAt = tick()
): Promise<string> {
  const ref = db.collection('comments').doc()
  const c: Omit<Comment, 'id'> = {
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body,
    createdAt,
    deliveredAt: null,
    workingAt: null,
    handledAt: null,
  }
  await ref.set(c)
  return ref.id
}

// The one stdout line the watcher prints for a reply.
export const replyLine = (task: string, kind: string, id: string, text: string) =>
  JSON.stringify({ task, kind, id, from: 'james', text })

export async function readComment(db: Firestore, id: string): Promise<Omit<Comment, 'id'>> {
  return (await db.collection('comments').doc(id).get()).data() as Omit<Comment, 'id'>
}
export async function readTask(db: Firestore, id: string): Promise<Omit<Task, 'id'>> {
  return (await db.collection('tasks').doc(id).get()).data() as Omit<Task, 'id'>
}
export async function readComments(db: Firestore, taskId: string): Promise<Comment[]> {
  const snap = await db.collection('comments').where('taskId', '==', taskId).get()
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// ---- the watcher ----------------------------------------------------------------------------

export interface WatcherExit {
  code: number | null
  lines: string[] // stdout, one entry per line
  stderr: string
}
export interface Watcher {
  pid: number
  exited: Promise<WatcherExit>
  stderr(): string
}

// `node wait.ts ...args` from a temporary folder, or `command` as given through a shell.
export function startWatcher(
  args: string[],
  opts: { offline?: boolean; command?: string } = {}
): Watcher {
  const env = childEnv(opts.offline)
  const cwd = tmp('watcher')
  const child = opts.command
    ? spawn(opts.command, { shell: true, cwd, env })
    : spawn(process.execPath, [WAIT_TS, ...args], { cwd, env })
  live.add(child)
  let out = ''
  let err = ''
  child.stdout.on('data', (d: Buffer) => (out += d.toString()))
  child.stderr.on('data', (d: Buffer) => (err += d.toString()))
  const exited = new Promise<WatcherExit>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      live.delete(child)
      const lines = out === '' ? [] : out.replace(/\r?\n$/, '').split(/\r?\n/)
      resolve({ code, lines, stderr: err })
    })
  })
  return { pid: child.pid!, exited, stderr: () => err }
}

// The watcher's exit; fails the test if it is still running after `ms`.
export async function finished(
  w: Pick<Watcher, 'exited'> & Partial<Pick<Watcher, 'stderr'>>,
  ms = 15_000
): Promise<WatcherExit> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`watcher still running after ${ms} ms:\n${w.stderr?.().slice(-1500)}`)),
      ms
    )
  })
  try {
    return await Promise.race([w.exited, late])
  } finally {
    clearTimeout(timer)
  }
}

// One whole watcher run for a fresh session with one reply already waiting. Tests await it to
// bound "nothing happened" without sleeping: a watcher started before it has had time to connect
// and wait, and the board and agent have had time to act on anything written before it.
export async function oneWatcherRun(db: Firestore): Promise<void> {
  const s = await seedSession(db)
  const id = await postReply(db, await seedTask(db, s), 'comment', 'marker')
  const run = await finished(startWatcher(['--agent', s.agentId]))
  if (run.code !== 0 || !run.lines.some((l) => l.includes(id)))
    throw new Error(
      `a watcher for a session with one reply waiting did not print it and exit 0 (exit ${run.code}):\n${run.stderr.slice(-1500)}`
    )
}

// ---- the real agent (a session) -------------------------------------------------------------

export interface Notice {
  method: string
  params?: { content?: string; meta?: Record<string, string> }
}
export interface ToolResult {
  isError: boolean
  text: string
}
export interface ToolInfo {
  name: string
  description?: string
  inputSchema: { properties?: Record<string, unknown>; required?: string[] }
}
export interface SessionClient extends Session {
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>
  json<T>(name: string, args?: Record<string, unknown>): Promise<T>
  tools(): Promise<ToolInfo[]>
  notices(): Notice[] // every notification the agent has sent so far
  notice(pred: (n: Notice) => boolean, what: string, ms?: number): Promise<Notice>
  close(): Promise<void>
}

// The real agent over stdio, from its own temporary project folder, registered on the board. Unlike
// app-logs-emulator's startAgent, notifications (messages without an id) are kept.
export async function startSession(name: string): Promise<SessionClient> {
  const child = spawn(process.execPath, [AGENT_TS], {
    env: childEnv(),
    cwd: tmp(`session-${name}`),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let err = ''
  child.stderr.on('data', (d: Buffer) => (err += d.toString()))
  type Reply = { id?: number; result?: Record<string, unknown>; error?: unknown } & Notice
  const waiting = new Map<number, (m: Reply) => void>()
  const notices: Notice[] = []
  const watchers = new Set<(n: Notice) => void>()
  let buf = ''
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString()
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const msg = JSON.parse(line) as Reply
      if (msg.id !== undefined) waiting.get(msg.id)?.(msg)
      else if (msg.method) {
        notices.push(msg)
        for (const w of watchers) w(msg)
      }
    }
  })
  let next = 1
  const send = (msg: object) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`)
  const request = (method: string, params: object) =>
    new Promise<Reply>((resolve, reject) => {
      const id = next++
      const timer = setTimeout(
        () => reject(new Error(`no reply to ${method}; agent stderr:\n${err.slice(-2000)}`)),
        15_000
      )
      waiting.set(id, (m) => {
        clearTimeout(timer)
        resolve(m)
      })
      send({ id, method, params })
    })
  await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: `replies-r1-${name}`, version: '0' },
  })
  send({ method: 'notifications/initialized' })

  const call = async (tool: string, args: Record<string, unknown> = {}) => {
    const m = await request('tools/call', { name: tool, arguments: args })
    if (m.error) throw new Error(`${tool} rpc error: ${JSON.stringify(m.error)}`)
    const r = m.result as { isError?: boolean; content?: { text: string }[] }
    return { isError: r.isError === true, text: r.content?.[0]?.text ?? '' }
  }
  const json = async <T>(tool: string, args: Record<string, unknown> = {}) => {
    const r = await call(tool, args)
    if (r.isError) throw new Error(`${tool} tool error: ${r.text}`)
    return JSON.parse(r.text) as T
  }
  const me = await json<Partial<Session>>('kanban_whoami')
  if (!me.agentId || !me.projectId) throw new Error(`agent not on the board:\n${err.slice(-2000)}`)
  return {
    agentId: me.agentId,
    projectId: me.projectId,
    call,
    json,
    async tools() {
      return ((await request('tools/list', {})).result as { tools: ToolInfo[] }).tools
    },
    notices: () => [...notices],
    notice: (pred, what, ms = 10_000) =>
      new Promise<Notice>((resolve, reject) => {
        const hit = notices.find(pred)
        if (hit) return resolve(hit)
        const timer = setTimeout(() => {
          watchers.delete(check)
          reject(new Error(`no notification: ${what}`))
        }, ms)
        const check = (n: Notice) => {
          if (!pred(n)) return
          clearTimeout(timer)
          watchers.delete(check)
          resolve(n)
        }
        watchers.add(check)
      }),
    close: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve()
        const timer = setTimeout(() => child.kill(), 10_000)
        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
        child.stdin.end()
      }),
  }
}

// One session per file, started before the first test and closed after the last (sessions are
// not in the after-each cleanup, so one lives across tests).
export function useSession(name: string): () => SessionClient {
  let session: SessionClient | null = null
  beforeAll(async () => {
    session = await startSession(name)
  }, 30_000)
  afterAll(() => session?.close(), 30_000)
  return () => {
    if (!session) throw new Error('useSession() has not started the agent')
    return session
  }
}

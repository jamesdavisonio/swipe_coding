// Shared setup for the app-logs L1 emulator suites (tests/emulator/app-logs-*.test.ts). Run with
// `npm run test:rules` (emulators:exec sets FIRESTORE_EMULATOR_HOST; project demo-kanban). Never
// against a live project.
//
// Web side: the real packages/web/src/lib/log.ts (real logger, real log store) writing to the
// emulator as James under the real firestore.rules. Each suite wires the mocks itself:
//   vi.mock('virtual:app-manifest', async () =>
//     (await import('../fixtures/app-logs-emulator.ts')).manifestModule())
//   vi.mock('../../packages/web/src/firebase.ts', async () =>
//     (await import('../fixtures/app-logs-emulator.ts')).firebaseModule())
// then calls useWebEmulator() at the top level of the file.
//
// Agent side: the stored `logs` read back with the agent's own admin db (emulator mode), and
// the real agent spawned over stdio against the same emulator (startAgent).
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  getDocs,
  waitForPendingWrites,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { Timestamp as AdminTimestamp, type Firestore as AdminDb } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
export const DAY = 24 * 60 * 60 * 1000
export const RETENTION = 30 * DAY // LOG_RETENTION_MS
export const STORED_KEYS = [
  'schema_version',
  'taxonomy_version',
  'timestamp',
  'severity',
  'app_id',
  'client_id',
  'env',
  'source',
  'event_type',
  'audience',
  'session_id',
  'trace_id',
  'user_id',
  'message',
  'context',
  'ts',
  'expireAt',
  'request_id',
].sort()

// ---- web ------------------------------------------------------------------------------------

type User = { uid: string; email: string; emailVerified: boolean }
const JAMES: User = { uid: 'james-uid', email: 'j@nullnoise.ai', emailVerified: true }
const web = {
  env: null as RulesTestEnvironment | null,
  james: null as Firestore | null,
  stranger: null as Firestore | null,
  db: null as Firestore | null,
  user: JAMES as User | null,
}

// The signed-in user as firebase/auth reports it (currentUser and the auth-state callbacks).
const auth = {
  get currentUser() {
    return web.user
  },
  onAuthStateChanged(cb: (u: User | null) => void) {
    cb(web.user)
    return () => {}
  },
  authStateReady: () => Promise.resolve(),
}

export const firebaseModule = () => ({
  app: {},
  auth,
  get db() {
    return web.db
  },
})
export const manifestModule = () => ({
  default: {
    app_id: 'kanban',
    client_id: 'jamesdavisonio',
    audience_default: 'internal',
    log_endpoint: null,
    env: 'prod',
  },
})

export function useWebEmulator() {
  beforeAll(async () => {
    web.env = await initializeTestEnvironment({
      projectId: 'demo-kanban',
      firestore: {
        rules: readFileSync(join(ROOT, 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
    const ctx = (uid: string, email: string) =>
      web.env!.authenticatedContext(uid, { email, email_verified: true }).firestore() as unknown
    web.james = ctx('james-uid', 'j@nullnoise.ai') as Firestore
    web.stranger = ctx('someone', 'someone@example.com') as Firestore
  })
  afterAll(async () => {
    await web.env?.cleanup()
    web.env = null
  })
  beforeEach(async () => {
    await web.env?.clearFirestore()
    web.db = web.james
    web.user = JAMES
  })
}

export const signOut = () => void (web.user = null)
export const signIn = () => void (web.user = JAMES)
// The app's Firestore becomes a browser the rules refuse (signed in, but not as James).
export const useRefusingDb = () => void (web.db = web.stranger)
export const useOwnerDb = () => void (web.db = web.james)
export const appDb = (): Firestore => {
  if (!web.db) throw new Error('useWebEmulator() has not started the emulator')
  return web.db
}

// Every stored log event, once the app's pending writes have reached the emulator.
export async function storedLogs(): Promise<DocumentData[]> {
  if (!web.env) throw new Error('useWebEmulator() has not started the emulator')
  await waitForPendingWrites(appDb())
  return serverSide()
}
// What the emulator holds right now, without waiting for the app.
export async function serverSide(): Promise<DocumentData[]> {
  let out: DocumentData[] = []
  await web.env!.withSecurityRulesDisabled(async (c) => {
    const snap = await getDocs(collection(c.firestore() as unknown as Firestore, 'logs'))
    out = snap.docs.map((d) => d.data())
  })
  return out
}
export const byRequest = (events: DocumentData[], id: string) =>
  events.filter((e) => e.request_id === id)

// ---- agent ----------------------------------------------------------------------------------

// The agent's admin db (emulator mode), imported lazily so web suites never start it.
export async function adminDb(): Promise<AdminDb> {
  return (await import('../../packages/agent/src/firestore.ts')).getDb()
}

export async function clearLogs() {
  const db = await adminDb()
  await db.recursiveDelete(db.collection('logs'))
}

export async function agentLogs(pred: (e: DocumentData) => boolean = () => true) {
  const snap = await (await adminDb()).collection('logs').get()
  return snap.docs.map((d) => d.data()).filter(pred)
}

// Resolves with the first stored event matching `pred`; rejects after `ms`.
export async function waitForLog(
  pred: (e: DocumentData) => boolean,
  what: string,
  ms = 8000
): Promise<DocumentData> {
  const db = await adminDb()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop()
      reject(new Error(`no stored log event: ${what}`))
    }, ms)
    const stop = db.collection('logs').onSnapshot((snap) => {
      const hit = snap.docs.map((d) => d.data()).find(pred)
      if (!hit) return
      clearTimeout(timer)
      stop()
      resolve(hit)
    })
  })
}

// A stored event as the contract shapes it, `minutesAgo` before now.
export function logDoc(e: {
  minutesAgo: number
  severity: string
  source: 'web_client' | 'server'
  request_id?: string | null
  message?: string
  event_type?: string
}) {
  const ts = Date.now() - e.minutesAgo * 60_000
  const request_id = e.request_id ?? null
  return {
    schema_version: 1,
    taxonomy_version: 6,
    timestamp: new Date(ts).toISOString(),
    severity: e.severity,
    app_id: 'kanban',
    client_id: 'jamesdavisonio',
    env: 'prod',
    source: e.source,
    event_type: e.event_type ?? 'api_call_failed',
    audience: 'internal',
    session_id: 's-test',
    trace_id: null,
    user_id: null,
    message: e.message ?? `${e.severity} ${e.minutesAgo}m`,
    context: { target: 'firestore', status: 'unavailable', ...(request_id ? { request_id } : {}) },
    ts,
    expireAt: AdminTimestamp.fromMillis(ts + RETENTION),
    request_id,
  }
}

export async function seedLogs(docs: ReturnType<typeof logDoc>[]) {
  const db = await adminDb()
  const batch = db.batch()
  for (const d of docs) batch.set(db.collection('logs').doc(), d)
  await batch.commit()
}

// What kanban_logs returns for one stored event.
export const asRead = (d: ReturnType<typeof logDoc>) => ({
  time: d.timestamp,
  severity: d.severity,
  event_type: d.event_type,
  source: d.source,
  message: d.message,
  request_id: d.request_id,
  context: d.context,
})

export interface ToolResult {
  isError: boolean
  text: string
}
export interface AgentClient {
  pid: number
  stderr(): string
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>
  json<T>(name: string, args?: Record<string, unknown>): Promise<T>
  tools(): Promise<{ name: string; inputSchema: { properties?: Record<string, unknown> } }[]>
  close(): Promise<void>
}

// The real agent over stdio against the emulator, from its own temporary project folder, the
// way Claude Code starts it. KANBAN_SA points at a file that is not a key, so nothing on this
// machine but the emulator can be reached; APP_ENV is unset (the agent's default applies).
export async function startAgent(name: string): Promise<AgentClient> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('run through npm run test:rules')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_PROJECT_ID: 'demo-kanban',
    KANBAN_SA: fileURLToPath(import.meta.url),
  }
  delete env.KANBAN_TEST_LIVE
  delete env.APP_ENV
  const child = spawn(process.execPath, [join(ROOT, 'packages', 'agent', 'src', 'index.ts')], {
    env,
    cwd: mkdtempSync(join(tmpdir(), `app-logs-${name}-`)),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let err = ''
  child.stderr.on('data', (d: Buffer) => (err += d.toString()))
  type Reply = { id?: number; result?: Record<string, unknown>; error?: unknown }
  const waiting = new Map<number, (m: Reply) => void>()
  let buf = ''
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString()
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const msg = JSON.parse(line) as Reply
      if (msg.id !== undefined) waiting.get(msg.id)?.(msg)
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
    clientInfo: { name: `app-logs-${name}`, version: '0' },
  })
  send({ method: 'notifications/initialized' })

  const call = async (tool: string, args: Record<string, unknown> = {}) => {
    const m = await request('tools/call', { name: tool, arguments: args })
    if (m.error) throw new Error(`${tool} rpc error: ${JSON.stringify(m.error)}`)
    const r = m.result as { isError?: boolean; content?: { text: string }[] }
    return { isError: r.isError === true, text: r.content?.[0]?.text ?? '' }
  }
  return {
    pid: child.pid!,
    stderr: () => err,
    call,
    async json<T>(tool: string, args: Record<string, unknown> = {}) {
      const r = await call(tool, args)
      if (r.isError) throw new Error(`${tool} tool error: ${r.text}`)
      return JSON.parse(r.text) as T
    },
    async tools() {
      const m = await request('tools/list', {})
      return (m.result as { tools: Awaited<ReturnType<AgentClient['tools']>> }).tools
    },
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

// One agent per file, started after the logs are cleared and closed after the last test.
export function useAgent(name: string): () => AgentClient {
  let agent: AgentClient | null = null
  beforeAll(async () => {
    agent = await startAgent(name)
  }, 30_000)
  afterAll(() => agent?.close(), 30_000)
  return () => {
    if (!agent) throw new Error('useAgent() has not started the agent')
    return agent
  }
}

export const AGENT_LOG = join(ROOT, 'packages', 'agent', 'agent.log')

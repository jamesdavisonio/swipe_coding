// Shared setup for the web-threads B4 emulator suites (tests/emulator/web-threads-b4-*.test.ts):
// the real packages/web/src/data.ts writing to the Firestore emulator as James, under the real
// firestore.rules, with firebase.ts pointed at that emulator database and the logger stubbed.
// Run with `npm run test:rules` (project demo-kanban); never against a live project.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../../packages/web/src/firebase.ts', async () =>
//     (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule())
//   vi.mock('../../packages/web/src/lib/log.ts', async () =>
//     (await import('../fixtures/web-threads-b4-emulator.ts')).logModule())
// then calls useEmulator() inside its describe blocks.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, expect, vi } from 'vitest'
import {
  LOG_CAP,
  initialTaskFields,
  type Comment,
  type LogEntry,
  type Task,
} from '../../packages/shared/src/index.ts'

const state = { env: null as RulesTestEnvironment | null, db: null as Firestore | null }

// firebase.ts as the app sees it, with `db` resolved when a write runs (after beforeAll).
export const firebaseModule = () => ({
  app: {},
  auth: {},
  get db() {
    return state.db
  },
})
export const logModule = () => ({
  log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
})

// Starts the emulator test environment once per file and empties the database before each test.
export function useEmulator() {
  beforeAll(async () => {
    state.env = await initializeTestEnvironment({
      projectId: 'demo-kanban',
      firestore: {
        rules: readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
    state.db = state.env
      .authenticatedContext('james-uid', { email: 'j@nullnoise.ai', email_verified: true })
      .firestore() as unknown as Firestore
  })
  afterAll(async () => {
    await state.env?.cleanup()
    state.env = null
    state.db = null
  })
  beforeEach(async () => {
    await state.env?.clearFirestore()
  })
}

// The database James's writes go to (the same one data.ts uses).
export function jamesDb(): Firestore {
  if (!state.db) throw new Error('useEmulator() has not started the emulator')
  return state.db
}

// ---- seeding ------------------------------------------------------------------------------

// A moment safely in the past, so a write's "now" is always later.
export const T0 = 1_700_000_000_000

// A complete task in the shared initial shape; overrides win. `id` is not stored.
export function makeTask(id: string, over: Partial<Task> = {}): Task {
  const base = initialTaskFields({
    projectId: over.projectId ?? 'p1',
    type: over.type ?? 'feature',
    title: over.title ?? `Task ${id}`,
    description: '',
    createdBy: 'james',
    afterDeploy: over.afterDeploy ?? [],
    now: T0,
  })
  return { ...base, agentId: 'agent-1', ...over, id }
}

// Writes the task (without its id) with the rules out of the way; returns it as the screen has it.
export async function seedTask(task: Task): Promise<Task> {
  const { id, ...stored } = task
  if (!state.env) throw new Error('useEmulator() has not started the emulator')
  await state.env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'tasks', id), stored)
  })
  return task
}

// `count` history entries, oldest first: "Entry 0", "Entry 1", ...
export const historyOf = (count: number): LogEntry[] =>
  Array.from({ length: count }, (_, i) => ({ at: T0 + i, who: 'session', text: `Entry ${i}` }))

export const FULL_LOG = () => historyOf(LOG_CAP)

// ---- reading back (as James, through the rules) --------------------------------------------

export async function readTask(id: string): Promise<Omit<Task, 'id'>> {
  const snap = await getDoc(doc(jamesDb(), 'tasks', id))
  if (!snap.exists()) throw new Error(`task ${id} is gone`)
  return snap.data() as Omit<Task, 'id'>
}

export async function readComments(taskId: string): Promise<Comment[]> {
  const snap = await getDocs(
    query(collection(jamesDb(), 'comments'), where('taskId', '==', taskId))
  )
  return snap.docs
    .map((d) => ({ ...(d.data() as Comment), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// The archived history entries of a task, oldest first.
export async function readArchive(taskId: string): Promise<LogEntry[]> {
  const snap = await getDocs(collection(jamesDb(), 'tasks', taskId, 'log_archive'))
  return snap.docs.map((d) => d.data() as LogEntry).sort((a, b) => a.at - b.at)
}

// The newest history entry.
export const lastEntry = (task: Pick<Task, 'log'>): LogEntry | undefined =>
  task.log[task.log.length - 1]

// What the task document holds, as seeded (the id is not stored).
export const stored = (task: Task): Omit<Task, 'id'> => {
  const { id: _id, ...rest } = task
  return rest
}

// Nothing was written: the task is as seeded, with no message and no archive.
export async function expectUntouched(task: Task) {
  expect(await readTask(task.id)).toEqual(stored(task))
  expect(await readComments(task.id)).toEqual([])
  expect(await readArchive(task.id)).toEqual([])
}

export { LOG_CAP }

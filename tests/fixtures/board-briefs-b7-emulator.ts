// Shared setup for the board-briefs B7 agent suites (tests/emulator/board-briefs-b7-*.test.ts):
// the desktop agent's real Board against the Firestore emulator, the way a session uses it through
// the kanban_* tools. Run with `npm run test:rules` (project demo-kanban; emulators:exec sets
// FIRESTORE_EMULATOR_HOST, so the Board's admin db is the emulator). Never against a live project.
//
// One Board per file, registered once (its own project from a unique cwd) and shut down after.
// Each test makes its own task with createTask (bound to this session) and moves it to the stage
// under test with the admin db, so no test depends on another's writes.
import { afterAll, beforeAll } from 'vitest'
import type { Comment, DecisionNotice, Task, TaskType } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'
import type { GithubPort } from '../../packages/agent/src/github.ts'
import type { PushOutcome, PushPort } from '../../packages/agent/src/push.ts'
import { adminDb, waitForLog } from './app-logs-emulator.ts'

type Db = Board['db']

const state = { board: null as Board | null }

export function useBoard(name: string): () => Board {
  beforeAll(async () => {
    const board = new Board(`/tmp/board-briefs-b7-${name}-${Date.now()}`)
    await board.register()
    state.board = board
  })
  afterAll(async () => {
    await state.board?.shutdown()
    state.board = null
  })
  return () => {
    if (!state.board) throw new Error('useBoard() has not registered the board')
    return state.board
  }
}

// A task of `type` made by this session, then set to `fields` (stage, needs, ...) as stored.
export async function taskAt(
  board: Board,
  type: TaskType,
  fields: Partial<Omit<Task, 'id'>>
): Promise<Task> {
  const task = await board.createTask({ title: `B7 ${type} at ${fields.stage ?? 'start'}`, type })
  await board.db.collection('tasks').doc(task.id).update(fields)
  return { ...task, ...fields }
}

export async function readTask(board: Board, id: string): Promise<Omit<Task, 'id'>> {
  const snap = await board.db.collection('tasks').doc(id).get()
  if (!snap.exists) throw new Error(`task ${id} is gone`)
  return snap.data() as Omit<Task, 'id'>
}

// The task's comments, oldest first.
export async function readComments(board: Board, taskId: string): Promise<Comment[]> {
  const snap = await board.db.collection('comments').where('taskId', '==', taskId).get()
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// ---- decision notifications (tests/emulator/decision-notifications-*.test.ts, notifier-*.test.ts) --
// Since docs/features/notifier.md the Board sends nothing: one notifier process sends every
// session's decisions. These suites run a real notifier (startNotifier) against the emulator with a
// fake push port, and drive it either through the Board (as a session would) or by writing tasks
// and comments with the Admin SDK (as any agent version, through any path, could).

// A push port that records every send and answers with `behave` (all tokens ok by default; it may
// return chosen outcomes or throw). Pass it to useNotifier(push).
export interface FakePush extends PushPort {
  calls: { notice: DecisionNotice; tokens: string[] }[]
  behave: (notice: DecisionNotice, tokens: string[]) => Promise<PushOutcome[]>
  reset(): void
}
export function fakePush(): FakePush {
  const allOk = (_n: DecisionNotice, tokens: string[]) =>
    Promise.resolve(tokens.map((token): PushOutcome => ({ token, ok: true })))
  const push: FakePush = {
    calls: [],
    behave: allOk,
    reset() {
      push.calls.length = 0
      push.behave = allOk
    },
    sendDecision(notice, tokens) {
      push.calls.push({ notice, tokens: [...tokens] })
      return push.behave(notice, tokens)
    },
  }
  return push
}

const dbOf = (from: Board | Db): Db => (from instanceof Board ? from.db : from)

// A GithubPort for suites that are not about PR checks: every PR stays pending, so a notifier started
// by a shared helper never runs the real `gh`.
export const idleGithub = (): GithubPort => ({
  prStatus: () =>
    Promise.resolve({
      state: 'OPEN',
      mergeable: 'UNKNOWN',
      head: 'idle',
      checks: [{ name: 'idle', status: 'PENDING', conclusion: '' }],
    }),
})

export const clearDevices = (from: Board | Db) =>
  dbOf(from).recursiveDelete(dbOf(from).collection('devices'))

// The devices collection holds exactly `tokens` (one document each, random ids).
export async function seedDevices(from: Board | Db, tokens: string[]): Promise<void> {
  const db = dbOf(from)
  await clearDevices(db)
  const t = Date.now()
  for (const token of tokens)
    await db.collection('devices').doc().set({ token, createdAt: t, updatedAt: t })
}
export async function deviceTokens(from: Board | Db): Promise<string[]> {
  const snap = await dbOf(from).collection('devices').get()
  return snap.docs.map((d) => d.get('token') as string).sort()
}
export async function projectName(board: Board): Promise<string> {
  const snap = await board.db.collection('projects').doc(board.id.projectId).get()
  return snap.get('name') as string
}

// Polls `probe` until it answers something truthy (a condition on observable state, never a fixed
// wait); rejects after `ms`.
export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  what: string,
  ms = 8000
): Promise<T> {
  const until = Date.now() + ms
  for (;;) {
    const v = await probe()
    if (v) return v
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 20))
  }
}

// One notifier per file, started on the emulator's admin db with `push` and stopped after the last
// test. The lease and the devices are cleared first so no other suite's leftovers interfere; the
// notifier's first pass over tasks other suites left behind may still send, so suites look at the
// sends of their own tasks only (sentFor). Returns the admin db.
export function useNotifier(push: PushPort): () => Db {
  let db: Db | null = null
  let notifier: { stop(): Promise<void> } | null = null
  beforeAll(async () => {
    db = await adminDb()
    await db.recursiveDelete(db.collection('notifier'))
    await clearDevices(db)
    // Imported here so suites that never run a notifier do not depend on it.
    const { startNotifier } = await import('../../packages/agent/src/notifier.ts')
    notifier = await startNotifier({ db, push, github: idleGithub() })
  })
  afterAll(async () => {
    await notifier?.stop()
    if (db) await clearDevices(db) // later suites must not find devices to send to
  })
  return () => {
    if (!db) throw new Error('useNotifier() has not started the notifier')
    return db
  }
}

// The notifications sent for one task (they all carry the task's tag).
export const sentFor = (push: FakePush, taskId: string) =>
  push.calls.filter((c) => c.notice.tag === `decision:${taskId}`)

export const waitForSends = (push: FakePush, taskId: string, n = 1) =>
  waitFor(
    () => Promise.resolve(sentFor(push, taskId).length >= n && sentFor(push, taskId)),
    `${n} notification(s) for task ${taskId}`
  )

export const NOTIFIER_PROJECT = { id: 'p-notifier-tests', name: 'Notified project' }

// A task written straight to Firestore with the Admin SDK, whole and well formed, in the notifier
// tests' own project (created on first use). `fields` override the defaults.
export async function putTask(db: Db, fields: Partial<Omit<Task, 'id'>> = {}): Promise<Task> {
  const t = Date.now()
  await db.collection('projects').doc(NOTIFIER_PROJECT.id).set({
    hostname: 'test-host',
    cwd: '/tmp/notifier-tests',
    name: NOTIFIER_PROJECT.name,
    createdAt: t,
    updatedAt: t,
  })
  const ref = db.collection('tasks').doc()
  const task: Omit<Task, 'id'> = {
    projectId: NOTIFIER_PROJECT.id,
    agentId: null,
    type: 'feature',
    title: `Notifier test ${ref.id}`,
    description: '',
    stage: 'build',
    needs: null,
    spec: null,
    afterDeploy: [],
    afterDone: [],
    pr: null,
    summary: '',
    createdBy: 'agent',
    createdAt: t,
    updatedAt: t,
    doneAt: null,
    reopenedAt: null,
    unread: false,
    working: false,
    lastCommentAt: null,
    log: [],
    ...fields,
  }
  await ref.set(task)
  return { ...task, id: ref.id }
}

export async function patchTask(db: Db, id: string, fields: Record<string, unknown>) {
  await db.collection('tasks').doc(id).update(fields)
}

// A comment written straight to Firestore. `createdAt` decides which is newest.
export async function putComment(
  db: Db,
  task: Pick<Task, 'id' | 'projectId'>,
  body: string,
  createdAt: number,
  o: { author?: 'james' | 'agent'; kind?: string } = {}
): Promise<string> {
  const ref = db.collection('comments').doc()
  await ref.set({
    taskId: task.id,
    projectId: task.projectId,
    agentId: null,
    author: o.author ?? 'agent',
    kind: o.kind ?? 'info',
    body,
    createdAt,
    deliveredAt: createdAt,
    workingAt: null,
    handledAt: null,
  })
  return ref.id
}

// "Nothing more was sent" is shown with a barrier: a fresh question that must be notified (so the
// devices must exist and the push port must answer) is awaited after the actions under test; the
// notifier handles changes in the order they were written, so every send those actions would have
// caused has happened by then.
export async function settle(db: Db, push: FakePush): Promise<void> {
  const b = await putTask(db, { needs: { kind: 'question', question: `Barrier ${Date.now()}?` } })
  await waitForSends(push, b.id)
}

// A deterministic barrier for log assertions: one known failing send on a fresh task, awaited in
// the stored logs. The process stores events in order, so once this one is readable every event
// from earlier actions in the file is too. Leaves the devices collection holding one token.
export async function logBarrier(db: Db, push: FakePush): Promise<void> {
  const behave = push.behave
  await seedDevices(db, ['tok-barrier'])
  push.behave = () => Promise.reject(Object.assign(new Error('barrier'), { code: 'barrier/end' }))
  const t = await putTask(db, { needs: { kind: 'question', question: 'Barrier?' } })
  await waitForLog((e) => e.context?.task_id === t.id, 'the barrier warning')
  push.behave = behave
}

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
import type { PushOutcome, PushPort } from '../../packages/agent/src/push.ts'
import { waitForLog } from './app-logs-emulator.ts'

const state = { board: null as Board | null }

export function useBoard(name: string, push?: PushPort): () => Board {
  beforeAll(async () => {
    const board = new Board(`/tmp/board-briefs-b7-${name}-${Date.now()}`, push)
    await board.register()
    state.board = board
  })
  afterAll(async () => {
    if (push && state.board) await clearDevices(state.board) // later suites must not find devices to send to
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

// ---- decision notifications (tests/emulator/decision-notifications-*.test.ts) -----------------

// A push port that records every send and answers with `behave` (all tokens ok by default; it may
// return chosen outcomes or throw). Pass it to useBoard(name, push).
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

export const clearDevices = (board: Board) =>
  board.db.recursiveDelete(board.db.collection('devices'))

// The devices collection holds exactly `tokens` (one document each, random ids).
export async function seedDevices(board: Board, tokens: string[]): Promise<void> {
  await clearDevices(board)
  const t = Date.now()
  for (const token of tokens)
    await board.db.collection('devices').doc().set({ token, createdAt: t, updatedAt: t })
}
export async function deviceTokens(board: Board): Promise<string[]> {
  const snap = await board.db.collection('devices').get()
  return snap.docs.map((d) => d.get('token') as string).sort()
}
export async function projectName(board: Board): Promise<string> {
  const snap = await board.db.collection('projects').doc(board.id.projectId).get()
  return snap.get('name') as string
}

// A deterministic barrier for log assertions: one known failing send on a fresh task, awaited in
// the stored logs. The process stores events in order, so once this one is readable every event
// from earlier actions in the file is too. Leaves the devices collection holding one token.
export async function logBarrier(board: Board, push: FakePush): Promise<void> {
  const behave = push.behave
  await seedDevices(board, ['tok-barrier'])
  push.behave = () => Promise.reject(Object.assign(new Error('barrier'), { code: 'barrier/end' }))
  const t = await taskAt(board, 'feature', { stage: 'build' })
  await board.ask(t.id, 'Barrier?')
  await waitForLog((e) => e.context?.task_id === t.id, 'the barrier warning')
  push.behave = behave
}

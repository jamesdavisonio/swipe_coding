// Shared setup for the board-briefs B7 agent suites (tests/emulator/board-briefs-b7-*.test.ts):
// the desktop agent's real Board against the Firestore emulator, the way a session uses it through
// the kanban_* tools. Run with `npm run test:rules` (project demo-kanban; emulators:exec sets
// FIRESTORE_EMULATOR_HOST, so the Board's admin db is the emulator). Never against a live project.
//
// One Board per file, registered once (its own project from a unique cwd) and shut down after.
// Each test makes its own task with createTask (bound to this session) and moves it to the stage
// under test with the admin db, so no test depends on another's writes.
import { afterAll, beforeAll } from 'vitest'
import type { Comment, Task, TaskType } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

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

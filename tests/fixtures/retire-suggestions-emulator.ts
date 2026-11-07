// Shared setup for the swipe-deck 65/66 suites (retiring suggestions): finished tasks seeded with
// the emulator admin db, and a spy that records every write to a task document.
// Run with `npm run test:rules`; never against a live project.
import { WriteBatch } from 'firebase-admin/firestore'
import { vi } from 'vitest'
import type { Task } from '../../packages/shared/src/index.ts'
import type { Board } from '../../packages/agent/src/board.ts'

export const DAY = 24 * 60 * 60 * 1000
export const LINES = ['Alpha - first', 'Beta - second', 'Gamma - third']
export const SUMMARY = `Done.\n\n### Suggested next\n${LINES.join('\n')}`

// A task made by this session, then stored as finished (or as `fields` say), unbound.
export async function seedDone(
  board: Board,
  fields: Partial<Omit<Task, 'id'>> = {}
): Promise<Task> {
  const task = await board.createTask({ title: 'Retire seed', type: 'chore' })
  const stored: Partial<Omit<Task, 'id'>> = {
    stage: 'done',
    needs: null,
    agentId: null,
    doneAt: Date.now() - 60 * 60 * 1000,
    summary: SUMMARY,
    ...fields,
  }
  await board.db.collection('tasks').doc(task.id).update(stored)
  return { ...task, ...stored }
}

export async function readStored(board: Board, id: string): Promise<Task> {
  const snap = await board.db.collection('tasks').doc(id).get()
  return { ...(snap.data() as Omit<Task, 'id'>), id }
}

// Records the document path of every write to a task. DocumentReference.update/set delegate to
// WriteBatch, so spying on the batch methods counts each write once.
export function watchTaskWrites() {
  const paths: string[] = []
  type Fn = (this: unknown, ...a: unknown[]) => unknown
  for (const method of ['update', 'set', 'create'] as const) {
    const original = Reflect.get(WriteBatch.prototype, method) as Fn
    vi.spyOn(WriteBatch.prototype, method as never).mockImplementation(function (
      this: unknown,
      ...a: unknown[]
    ) {
      const p = (a[0] as { path?: string }).path
      if (p?.startsWith('tasks/')) paths.push(p)
      return original.apply(this, a)
    })
  }
  return {
    count: (taskId: string) => paths.filter((p) => p === `tasks/${taskId}`).length,
    total: () => paths.length,
  }
}

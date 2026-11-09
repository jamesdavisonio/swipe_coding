// pr-ready 127 in the Firestore emulator (`npm run test:rules`): when a session sets a PR on a task
// in a stage that makes it wait on James's merge (build, fix, pr), the task moves to `pr` with
// `pr.checks: 'pending'` and no need, so the deck shows no merge card for it. Other stages only
// record the PR. The real Board, as a session uses it through kanban_update_task.
import { describe, expect, it } from 'vitest'
import type { Task, TaskType } from '../../packages/shared/src/index.ts'
import { buildDeck } from '../../packages/web/src/lib/deck.ts'
import { readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

const board = useBoard('pr-ready-127')
const URL = 'https://github.com/jamesdavisonio/kanban/pull/41'

const deckFor = (id: string, stored: Omit<Task, 'id'>) =>
  buildDeck({
    tasks: [{ ...stored, id }],
    projects: [],
    specBodies: {},
    handledNext: [],
    passed: [],
    now: Date.now(),
  }).filter((c) => c.taskId === id)

describe('pr-ready 127: setting a PR makes the task wait on its checks, not on James', () => {
  it.each([
    ['a feature at build', 'feature', 'build'],
    ['a bugfix at fix', 'bugfix', 'fix'],
    ['a feature already at pr (the PR is set again)', 'feature', 'pr'],
  ] as [string, TaskType, Task['stage']][])(
    '%s: stage pr, checks pending, no need, no merge card',
    async (_name, type, stage) => {
      const task = await taskAt(board(), type, { stage })
      const before = Date.now()
      await board().updateTask({ task_id: task.id, pr_url: URL })
      const stored = await readTask(board(), task.id)
      expect(stored.stage).toBe('pr')
      expect(stored.needs).toBeNull()
      expect(stored.pr).toMatchObject({ number: 41, url: URL, checks: 'pending' })
      expect(stored.pr?.pendingSince).toBeGreaterThanOrEqual(before)
      expect(stored.pr?.pendingSince).toBeLessThanOrEqual(Date.now())
      expect(deckFor(task.id, stored).filter((c) => c.kind === 'merge')).toEqual([])
    }
  )

  it('a PR set at an earlier stage is only recorded: the stage and need stay, no checks yet', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'spec', needs: null })
    await board().updateTask({ task_id: task.id, pr_url: URL })
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('spec')
    expect(stored.needs).toBeNull()
    expect(stored.pr).toMatchObject({ number: 41, url: URL })
    expect(stored.pr?.checks).toBeUndefined()
  })

  it('a chore at do (its chain has no pr stage) only records the PR', async () => {
    const task = await taskAt(board(), 'chore', { stage: 'do', needs: null })
    await board().updateTask({ task_id: task.id, pr_url: URL })
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('do')
    expect(stored.needs).toBeNull()
    expect(stored.pr).toMatchObject({ number: 41, url: URL })
    expect(stored.pr?.checks).toBeUndefined()
  })

  it('a PR set at a later stage is only recorded too', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'merged', needs: null })
    await board().updateTask({ task_id: task.id, pr_url: URL })
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('merged')
    expect(stored.needs).toBeNull()
    expect(stored.pr?.checks).toBeUndefined()
  })
})

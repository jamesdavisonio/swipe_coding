// Repro for the stale stage need (fix/stale-stage-need): when kanban_subtask marks a stage done
// (Board.setSubtask) and the task jumps past its current stage, the need that the skipped stage
// was waiting on must clear, exactly as it does when that stage itself is marked done. Seen live
// on 2026-11-05: a task at pr waiting on the merge (needs { kind: 'pr' }) was marked "merged"
// done, moved to main_ci, and still showed as waiting on James's merge.
// Runs the real Board against the Firestore emulator (`npm run test:rules`).
import { describe, expect, it } from 'vitest'
import type { Task, TaskType } from '../../packages/shared/src/index.ts'
import { readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

const board = useBoard('stale-need')

describe('marking a later stage done clears the need of the stage it skips', () => {
  it.each([
    [
      'a feature at pr waiting on the merge, "merged" done',
      'feature',
      'pr',
      'pr',
      'merged',
      'main_ci',
    ],
    [
      'a bugfix at pr waiting on the merge, "merged" done',
      'bugfix',
      'pr',
      'pr',
      'merged',
      'main_ci',
    ],
    [
      'a feature at spec waiting on approval, "approved" done',
      'feature',
      'spec',
      'spec',
      'approved',
      'build',
    ],
  ] as [string, TaskType, Task['stage'], 'pr' | 'spec', string, Task['stage']][])(
    '%s: moves on and waits on nothing',
    async (_name, type, stage, need, key, next) => {
      const task = await taskAt(board(), type, { stage, needs: { kind: need } })
      await board().setSubtask(task.id, key, 'done')
      const stored = await readTask(board(), task.id)
      expect(stored.stage).toBe(next)
      expect(stored.needs).toBeNull()
    }
  )

  it('marking the waiting stage itself done still clears its need (unchanged)', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'pr', needs: { kind: 'pr' } })
    await board().setSubtask(task.id, 'pr', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('merged')
    expect(stored.needs).toBeNull()
  })

  it('an open question is not a stage need: it stays when stages are skipped', async () => {
    const needs = { kind: 'question' as const, question: 'Which branch should this go to?' }
    const task = await taskAt(board(), 'feature', { stage: 'pr', needs })
    await board().setSubtask(task.id, 'merged', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('main_ci')
    expect(stored.needs).toEqual(needs)
  })

  it('a stage the task has already passed changes nothing', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await board().setSubtask(task.id, 'pr', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('main_ci')
    expect(stored.needs).toBeNull()
  })
})

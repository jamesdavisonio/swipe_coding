// board-briefs B7, criterion 34 (the agent half): kanban_update_task with a pr_url (Board.updateTask)
// on a task at its build or fix stage, or already at pr, moves it to stage pr and makes it wait on
// James's merge decision (needs { kind: 'pr' }) besides recording the PR. At an earlier stage it
// records the PR only; at merged or later it records the PR only and leaves the need as it is.
// Runs the real Board against the Firestore emulator (`npm run test:rules`).
import { describe, expect, it } from 'vitest'
import type { Task, TaskType } from '../../packages/shared/src/index.ts'
import { readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

const URL = 'https://github.com/nullnoise/kanban/pull/57'
const PR = { number: 57, url: URL }

const board = useBoard('34')

describe('B7-34 a reported pull request raises the merge decision', () => {
  it.each([
    ['a feature at build', 'feature', { stage: 'build', needs: null }],
    ['a bugfix at fix', 'bugfix', { stage: 'fix', needs: null }],
    [
      'a feature already at pr',
      'feature',
      {
        stage: 'pr',
        needs: null,
        pr: { number: 3, url: 'https://github.com/nullnoise/kanban/pull/3' },
      },
    ],
    ['a bugfix at pr whose need was cleared', 'bugfix', { stage: 'pr', needs: null }],
  ] as [string, TaskType, Partial<Task>][])(
    '%s: stage pr, waiting on the merge, PR recorded',
    async (_name, type, fields) => {
      const task = await taskAt(board(), type, fields)
      await board().updateTask({ task_id: task.id, pr_url: URL })
      const stored = await readTask(board(), task.id)
      expect(stored.stage).toBe('pr')
      expect(stored.needs).toEqual({ kind: 'pr' })
      expect(stored.pr).toEqual(PR)
    }
  )
})

describe('B7-34 a pull request reported outside the build stages', () => {
  it.each([
    [
      'a feature at spec, waiting on the spec',
      'feature',
      { stage: 'spec', needs: { kind: 'spec' } },
    ],
    ['a feature at approved', 'feature', { stage: 'approved', needs: null }],
  ] as [string, TaskType, Partial<Task>][])(
    '%s: records the PR only (stage and need unchanged)',
    async (_name, type, fields) => {
      const task = await taskAt(board(), type, fields)
      await board().updateTask({ task_id: task.id, pr_url: URL })
      const stored = await readTask(board(), task.id)
      expect(stored.stage).toBe(fields.stage)
      expect(stored.needs).toEqual(fields.needs)
      expect(stored.pr).toEqual(PR)
    }
  )

  it.each([
    ['a feature at merged', 'feature', { stage: 'merged', needs: null }],
    ['a bugfix at main_ci', 'bugfix', { stage: 'main_ci', needs: null }],
    [
      'a feature at after_deploy, waiting on the steps',
      'feature',
      {
        stage: 'after_deploy',
        needs: { kind: 'after_deploy' },
        afterDeploy: ['Open the site'],
        afterDone: [false],
      },
    ],
  ] as [string, TaskType, Partial<Task>][])(
    '%s: records the PR only and leaves the need',
    async (_name, type, fields) => {
      const task = await taskAt(board(), type, fields)
      await board().updateTask({ task_id: task.id, pr_url: URL })
      const stored = await readTask(board(), task.id)
      expect(stored.stage).toBe(fields.stage)
      expect(stored.needs).toEqual(fields.needs)
      expect(stored.pr).toEqual(PR)
    }
  )
})

// Repro for the swallowed Done summary (fix/last-stage-done): kanban_subtask (Board.setSubtask)
// marking the last stage before `done` as done or skipped moved the task straight to done,
// unbound it and wrote no Done message, so the session's next call, kanban_update_task done with
// its summary, was refused as "not bound to this session" and the summary never reached the
// thread. Seen live on 2026-11-06 closing the tasks for PRs 19 and 20. kanban_subtask must never
// finish a task: such a call is refused with a BoardError pointing at kanban_update_task "done",
// and nothing is written; finishing through updateTask works as before.
// Runs the real Board against the Firestore emulator (`npm run test:rules`).
import { describe, expect, it } from 'vitest'
import type { Task, TaskType } from '../../packages/shared/src/index.ts'
import { BoardError, type SubtaskStatus } from '../../packages/agent/src/board.ts'
import { readComments, readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

const board = useBoard('last-stage-done')

const AFTER_DEPLOY = { afterDeploy: ['Check the phone'], afterDone: [false] }

// The call is refused with a BoardError that tells the session to finish with kanban_update_task.
async function expectFinishRefused(call: Promise<unknown>): Promise<void> {
  const err = await call.then(
    () => null,
    (e: unknown) => e
  )
  expect(err, 'kanban_subtask finished the task instead of refusing').toBeInstanceOf(BoardError)
  expect((err as BoardError).message).toContain('kanban_update_task')
  expect((err as BoardError).message).toContain('"done"')
}

// Refused, and the stored task and its thread are exactly as they were.
async function expectRefusedUnchanged(
  taskId: string,
  key: string,
  status: SubtaskStatus,
  note?: string
): Promise<void> {
  const before = await readTask(board(), taskId)
  const commentsBefore = (await readComments(board(), taskId)).length
  await expectFinishRefused(board().setSubtask(taskId, key, status, note))
  expect(await readTask(board(), taskId)).toEqual(before)
  expect((await readComments(board(), taskId)).length).toBe(commentsBefore)
}

describe('kanban_subtask never finishes a task', () => {
  it('F1: a feature at main_ci (no after-deploy), "main_ci" done is refused and the task is unchanged', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await expectRefusedUnchanged(task.id, 'main_ci', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('main_ci')
    expect(stored.agentId).toBe(board().id.agentId)
    expect(stored.doneAt).toBeNull()
    expect(stored.needs).toBeNull()
  })

  it('F2: the same call with a note is refused the same way and writes no comment', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await expectRefusedUnchanged(task.id, 'main_ci', 'done', 'Main green')
  })

  it('F3: "skipped" on the last stage is refused the same way, task unchanged', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await expectRefusedUnchanged(task.id, 'main_ci', 'skipped')
  })

  it('F4: the key "done" itself is refused the same way, task unchanged', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await expectRefusedUnchanged(task.id, 'done', 'done')
  })

  it.each([
    ['a bugfix at main_ci marking "main_ci" done', 'bugfix', { stage: 'main_ci' }, 'main_ci'],
    ['a chore at do marking "do" done', 'chore', { stage: 'do' }, 'do'],
    [
      'a feature with after-deploy steps at after_deploy marking "after_deploy" done',
      'feature',
      { stage: 'after_deploy', ...AFTER_DEPLOY },
      'after_deploy',
    ],
  ] as [string, TaskType, Partial<Omit<Task, 'id'>>, string][])(
    "F5: follows the task's own chain: %s is refused, task unchanged",
    async (_name, type, fields, key) => {
      const task = await taskAt(board(), type, { needs: null, ...fields })
      await expectRefusedUnchanged(task.id, key, 'done')
    }
  )

  it('F6: jumping ahead onto the last stage is refused: a feature at merged marking "main_ci" done stays at merged', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'merged', needs: null })
    await expectRefusedUnchanged(task.id, 'main_ci', 'done')
    expect((await readTask(board(), task.id)).stage).toBe('merged')
  })

  it('F7: after a refusal, kanban_update_task done with a summary finishes the task and posts the Done message', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await expectFinishRefused(board().setSubtask(task.id, 'main_ci', 'done'))
    const commentsBefore = await readComments(board(), task.id)
    const summary =
      'Shipped: kanban_subtask no longer finishes a task.\n\n' +
      '### Suggested next\n' +
      'Close the PR 19 and PR 20 tasks with their summaries'
    await board().updateTask({ task_id: task.id, status: 'done', summary: `\n  ${summary}  \n` })

    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('done')
    expect(typeof stored.doneAt).toBe('number')
    expect(stored.agentId).toBeNull()
    expect(stored.needs).toBeNull()
    expect(stored.unread).toBe(true)

    const added = (await readComments(board(), task.id)).slice(commentsBefore.length)
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ kind: 'done', author: 'agent', body: summary })
  })
})

describe('kanban_subtask still advances when the next stage is not done (unchanged)', () => {
  it('F8: a feature at merged marking "merged" done moves to main_ci and stays bound', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'merged', needs: null })
    await board().setSubtask(task.id, 'merged', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('main_ci')
    expect(stored.agentId).toBe(board().id.agentId)
  })

  it('F8: a feature with after-deploy steps at main_ci marking "main_ci" done moves to after_deploy and stays bound', async () => {
    const task = await taskAt(board(), 'feature', {
      stage: 'main_ci',
      needs: null,
      ...AFTER_DEPLOY,
    })
    await board().setSubtask(task.id, 'main_ci', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('after_deploy')
    expect(stored.agentId).toBe(board().id.agentId)
  })
})

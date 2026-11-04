// board-briefs B7, criterion 35 (the agent half): kanban_update_task with status "done"
// (Board.updateTask) on a task that is not done also writes the session's Done message (a comment
// of kind done whose body is the given summary, or "Done." without one) and marks the task unread,
// in the same write as finishing it; a task already done gets no second Done message.
// Runs the real Board against the Firestore emulator (`npm run test:rules`).
import { describe, expect, it } from 'vitest'
import { readComments, readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

// A summary brief with suggestions, as a session would finish with it.
const SUMMARY = [
  '## Decision brief (summary)',
  '',
  '### Where it came from',
  'You asked for this on 4 November.',
  '',
  '### Why it exists',
  'Replies could show up in the wrong order.',
  '',
  '### What will change',
  'Replies now always show in the order they were sent.',
  '',
  '### Key assumptions',
  'Two replies in the same second keep their arrival order.',
  '',
  '### Out of scope',
  'Editing replies.',
  '',
  "### What you're agreeing to",
  'Nothing reaches users until you merge.',
  '',
  '### Suggested next',
  '- Add search to Projects',
].join('\n')

const board = useBoard('35')

const doneMessages = async (taskId: string) =>
  (await readComments(board(), taskId)).filter((c) => c.kind === 'done')

describe('B7-35 finishing a task writes the Done message', () => {
  it('writes one Done message carrying the summary and marks the task unread', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null, unread: false })
    await board().updateTask({ task_id: task.id, status: 'done', summary: SUMMARY })
    const done = await doneMessages(task.id)
    expect(done).toHaveLength(1)
    expect(done[0]).toEqual(
      expect.objectContaining({ author: 'agent', kind: 'done', body: SUMMARY, taskId: task.id })
    )
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('done')
    expect(stored.unread).toBe(true)
    expect(stored.summary).toBe(SUMMARY)
  })

  it('says "Done." when the session gives no summary', async () => {
    const task = await taskAt(board(), 'chore', { stage: 'do', needs: null, unread: false })
    await board().updateTask({ task_id: task.id, status: 'done' })
    const done = await doneMessages(task.id)
    expect(done).toHaveLength(1)
    expect(done[0].body).toBe('Done.')
    expect((await readTask(board(), task.id)).unread).toBe(true)
  })

  it('writes no second Done message for a task that is already done', async () => {
    // Already done but still bound to this session (agentId kept), so the call reaches the
    // already-done guard instead of being refused as someone else's task.
    const task = await taskAt(board(), 'bugfix', {
      stage: 'done',
      doneAt: Date.now() - 60_000,
      needs: null,
      working: false,
      unread: false,
    })
    // The contract may let the call be refused; either way nothing may be written.
    await board()
      .updateTask({ task_id: task.id, status: 'done', summary: 'Fixed the export again.' })
      .catch((err: unknown) => err)
    expect(await doneMessages(task.id)).toEqual([])
    expect((await readTask(board(), task.id)).unread).toBe(false)
  })

  it('does not write a Done message for other updates', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'build', needs: null })
    await board().updateTask({ task_id: task.id, status: 'in_progress', summary: 'Halfway.' })
    await board().updateTask({ task_id: task.id, summary: 'Nearly there.' })
    expect(await doneMessages(task.id)).toEqual([])
    const done = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await board().updateTask({ task_id: done.id, status: 'done', summary: 'Shipped.' })
    expect((await doneMessages(done.id)).map((c) => c.body)).toEqual(['Shipped.'])
  })
})

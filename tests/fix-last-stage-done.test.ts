// Repro for the swallowed Done summary (fix/last-stage-done), session-instructions half: the
// instructions every session receives on initialize must say that kanban_subtask does not finish
// a task (marking the last stage before done through it is refused; kanban_update_task "done" with
// a summary finishes). The board behaviour itself is in tests/emulator/fix-last-stage-done.test.ts.
// Runs with `npm test` (no Firestore).
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

describe('fix/last-stage-done: the session instructions', () => {
  it('F9: SESSION_INSTRUCTIONS say "kanban_subtask does not finish a task"', () => {
    expect(SESSION_INSTRUCTIONS).toContain('kanban_subtask does not finish a task')
  })
})

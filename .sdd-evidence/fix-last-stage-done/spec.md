# Fix spec: ticking the last stage swallows the Done summary (fix/last-stage-done)

Status: fix confirmed by James, 2026-11-06. Class: Small (bugfix, agent tool contract).

## The defect (proven)

Sessions finish a task with `kanban_update_task` status "done" plus a summary
(`Board.updateTask`): that writes the task's Done message (a comment of kind `done` whose body is
the summary) and sets `unread: true` in the same batch, and unbinds the task (`agentId: null`).

`kanban_subtask` (`Board.setSubtask(taskId, key, status, note?)`) has a second way to finish:
marking the stage just before `done` as done or skipped (for example `main_ci` on a feature with
no after-deploy steps) moves the task straight to `done`, unbinds it and writes **no** Done
message. The session's next call, `kanban_update_task` done with its summary, is then refused
with `task <id> is not bound to this session; call kanban_start_task first`, so the summary
never reaches the thread. Seen live on 2026-11-06 closing the tasks for PRs 19 and 20.

## The fix (behaviour)

`kanban_subtask` never finishes a task. When marking a stage done or skipped would move the task
to `done` (the stage is the last one before `done` in the task's own chain, or the key is `done`
itself), the call is refused with a `BoardError` and nothing is written. The error tells the
session how to finish: call `kanban_update_task` with status "done" and a summary. Finishing
through `kanban_update_task` works exactly as today.

Stage chains (packages/shared/src/templates.ts): feature `spec, approved, build, pr, merged,
main_ci, [after_deploy], done`; bugfix `fix, pr, merged, main_ci, [after_deploy], done`; chore
`do, [after_deploy], done`. `after_deploy` is in the chain only when the task's `afterDeploy`
list is non-empty.

## Acceptance criteria

F1. A feature task bound to this session, at `main_ci`, with no after-deploy steps:
`setSubtask(id, 'main_ci', 'done')` rejects with a `BoardError` whose message contains
`kanban_update_task` and `"done"` (with the double quotes). The stored task document is
unchanged (deep-equal before and after: stage still `main_ci`, `agentId` still this session,
`doneAt` still null, `needs` as before, `updatedAt` not touched) and the task's comment count
is unchanged.
F2. The same call with a note (`setSubtask(id, 'main_ci', 'done', 'Main green')`) is refused the
same way and writes no comment.
F3. Status `skipped` on that last stage is refused the same way, task unchanged.
F4. Key `done` itself (`setSubtask(id, 'done', 'done')`) is refused the same way, task unchanged.
F5. The rule follows each task's own chain: refused, task unchanged, for - a bugfix at `main_ci` marking `main_ci` done; - a chore at `do` marking `do` done; - a feature with after-deploy steps (`afterDeploy: ['Check the phone']`, `afterDone: [false]`)
at `after_deploy` marking `after_deploy` done.
F6. Jumping ahead onto the last stage is refused too: a feature at `merged` marking `main_ci`
done is refused, and the task stays at `merged`, unchanged.
F7. After a refusal, finishing works: `updateTask({ task_id, status: 'done', summary })` on the
same task succeeds; the stored task has stage `done`, a numeric `doneAt`, `agentId` null,
`needs` null and `unread` true, and exactly one new comment of kind `done`, author `agent`,
whose body is the summary (a multi-line summary ending in a `### Suggested next` section is
stored verbatim, trimmed).
F8. Unchanged behaviour: a stage whose next stage is not `done` still advances: a feature at
`merged` marking `merged` done moves to `main_ci`; a feature with after-deploy steps at
`main_ci` marking `main_ci` done moves to `after_deploy`. Both stay bound to the session.
F9. The session instructions (`SESSION_INSTRUCTIONS`, exported from
`packages/agent/src/instructions.ts`, sent to every session on initialize) contain the exact
text `kanban_subtask does not finish a task`.

## Contract details fixed now

- The refusal is a thrown `BoardError` (exported from `packages/agent/src/board.ts`), the same
  class the board uses for its other refusals; through MCP it surfaces as a tool error.
- Message contains `kanban_update_task` and `"done"`; exact wording is otherwise free.
- No new task or comment fields; no web or rules change.

## Out of scope

Tasks already closed without a summary; the phone's own buttons (web `data.ts` advancing a task);
what happens to after-deploy tasks once James ticks the steps.

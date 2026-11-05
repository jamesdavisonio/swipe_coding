# fix-stale-stage-need — fresh-context review (claude-opus, fresh context)

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 6 (+6/-3 in packages/agent/src/board.ts, 2 of them comment) / tests 0 after the red checkpoint (the 74-line repro was added in b3ac3cb itself)
- Duplicated helpers: none. It reuses `taskStages`, `NEED_OF_STAGE` and `donePatch`.
- Harness files added: none

`advancePast` now clears a need that belongs to any stage from the task's current stage through the marked stage (`chain.slice(Math.max(0, indexOf(task.stage)), indexOf(stage)+1)` matched against `NEED_OF_STAGE`), as the spec in b3ac3cb asks. The three skip cases fail on the old code (`NEED_OF_STAGE['merged']` / `['approved']` are undefined); a question need is never cleared (`NEED_OF_STAGE` never maps to `question`); the already-passed guard returns before the slice; the waiting stage itself is still in `passed`; an after_deploy need is the stage being entered, so it is kept; `advancePast` is only called from `subtaskPatch` (`done` and `skipped`), and no caller relied on the old narrow clearing.

Anti-gaming: no test changes after b3ac3cb; no `.only`/`.skip`, `ts-ignore`, `as any`, eslint-disable or swallowed catch; no test literals in the implementation; no widened assertions, sleeps or retries.

Evidence (reviewer, HEAD 59a8559): typecheck clean; `npx vitest run` 51 files / 532 passed; `npm run test:rules` 29 files / 233 passed, the repro 6/6.

Minor follow-ups (not blocking):

1. A task whose stage is not in its own chain (e.g. at after_deploy after its steps were emptied): `indexOf` is -1, `Math.max(0, …)` starts `passed` at the chain's beginning, so a spec or pr need could clear; arguably right, untested — add a test or a comment. Not a regression (the stage already moved backwards there).
2. The same bug class on another path: `kanban_subtask … in_progress` on a later stage moves the task forward without clearing the skipped stage's need (board.ts ~622-626). Out of this fix's scope; candidate follow-up.
3. Red was confirmed by reading the old code (the review was read-only); the orchestrator ran the repro red before the fix (3 failed, 3 passed).

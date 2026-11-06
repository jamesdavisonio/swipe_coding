# Evidence: kanban_subtask never finishes a task (fix/last-stage-done)

Fix confirmed by James in the session chat, 2026-11-06 ("Fixed, confirmed.", voice typing).
Class Small (bugfix). Profile anthropic-only (context isolation).
Models: test author Opus (isolated) · fidelity checker Opus (fresh) · builder Sonnet (isolated) · reviewer Opus (fresh).

## Root cause

`advancePast` (packages/agent/src/board.ts) returned `donePatch` when the stage after the one
being marked was `done`: the task finished and was unbound with no Done message, so the
session's follow-up `kanban_update_task` done + summary was refused as "not bound". Seen live
closing the tasks for PRs 19 and 20.

## Commits since red checkpoint 0a852df

- 425f95d fix(agent): kanban_subtask never finishes a task
- 82f0fb6 docs(agent): re-wrap the finishing rule in the session instructions
- 806eb48 docs(agent): name the finishing call wherever kanban_subtask is described

## Tests

`git diff 0a852df..HEAD -- tests` is empty. At red: 10 failing on the bug (F1–F7, F9),
2 passing by design (F8 guards unchanged advancing).

## Fidelity

PASS on round 1, no gaps, no gaming flags (fidelity-verdict.md).

## Review

Fresh Opus reviewer: **shippable**. Four minor wording notes (tool description, stage-key list,
line wrap, DESIGN.md) were applied in 82f0fb6/806eb48 by the orchestrator; no behaviour change.

## Checks (checks/, after the final commit)

typecheck exit 0 · lint exit 0 (11 warnings, same as main) · unit 545/545 · emulator rules
285/285 · agent protocol 24 ok, all good (emulator) · build:web exit 0 · rules-lint exit 0 ·
secrets/stray grep: no hits.

# 3. Task stage model, decision history and comment delivery states

Date: 2026-11-02

## Status

Accepted

## Context

Phase 1 modelled a task as a `status` (`queued | in_progress | waiting_on_james |
blocked_on_permission | done | orphaned`) plus a per-type list of `subtasks` the session
ticked, and a single `openQuestion`. The agreed product (`prototype/index.html`,
`docs/features/web-threads.md`) needs something the phone can render directly and the
session can advance unambiguously: a fixed stage chain per task type, an explicit "what
James needs to decide right now", a decision history separate from the chat, after-deploy
steps as part of the task, and delivery ticks on James's messages. Three parties write the
same documents — the web app as James, desktop agents through the Admin SDK, and later
hooks — so the shape has to be shared and the transitions guarded.

## Decision

Defined once in `packages/shared` and consumed by web and agent:

- **Stage chain** `Stage = spec | approved | build | fix | do | pr | merged | main_ci |
after_deploy | done`; `stagesFor(type, hasAfterDeploy)` gives `feature` →
  `spec, approved, build, pr, merged, main_ci, [after_deploy], done`; `bugfix` → `fix, pr,
…`; `chore` → `do, done`; `for_james` → `[]` (its document rests at stage `do` and is
  never queued or advanced). `status` and `subtasks` are retired; "queued" is derived
  (`stage` is the first stage and `agentId` is null).
- **Needs** — `task.needs: { kind: spec | question | pr | after_deploy, question?,
options? } | null` is the only thing the home screen reads to decide "needs you"; the
  session sets it, James's decision clears it.
- **After deploy** — `afterDeploy: string[]` (the steps) and `afterDone: boolean[]`
  (James's ticks) on the task; all ticked ⇒ `done`.
- **Done is soft** — `doneAt` marks completion; lists hide tasks more than
  `DONE_VISIBLE_MS` (7 days) after `doneAt`; nothing is deleted; `reopenedAt` records a
  reopen, which moves the stage back one step.
- **Decision history** — `log: LogEntry[]` (`at`, `who: james | session | system`, `text`)
  on the task, append-only, capped at `LOG_CAP = 200`; `appendLog` returns the overflow,
  which the writer moves to `tasks/{id}/log_archive`.
- **Comment kinds** split by author: James writes `comment | answer | approve |
change_request | merged | reopen`; the session writes `spec | question | pr |
after_deploy | done | info | system`. Firestore rules only let the browser create the
  James kinds.
- **Delivery state** is derived, never stored: `deliveryState()` reads `deliveredAt`,
  `workingAt`, `handledAt` and returns `sent → delivered → working → handled`,
  monotonic (a later stamp wins even if an earlier one is missing).
- **Transitions James owns** (approve, merged, after-deploy complete, reopen) are
  Firestore transactions guarded on the expected current stage, so a double tap is a
  no-op (`_principles/idempotency.md`).
- **Indexes**: `tasks(projectId, stage, updatedAt desc)` for project tabs and
  `tasks(projectId, doneAt desc)` for Done / Show older; the `status` indexes go.
- **Phase 1 data** on the live board is deleted rather than migrated (single owner, test
  data only).

## Consequences

- The agent keeps its ten tools in B1 through a thin compatibility mapping (`subtask` →
  stage/needs, `update_task status` → stage); the real four-moment tool set
  (`kanban_submit_spec`, `kanban_pr_ready`, `kanban_log`) is DESIGN.md Phase 2 package 2
  and replaces that mapping.
- The web app (B2–B6) renders from `stage`, `needs`, `log` and the derived delivery state
  only; it never infers state from message text.
- A task document grows with its history; the 200-entry cap keeps it far below Firestore's
  1 MiB limit while B6 can page the archive on demand.
- `firestore.rules` gains a `log_archive` subcollection rule and the comment-kind check
  (create limited to the James kinds; `author` and `kind` frozen on update); they are
  tested behaviourally in the Firestore emulator (`npm run test:rules`,
  `tests/rules/web-threads-b1-4.rules.test.ts`), with rules-lint as the cheap guard.

# Fresh-context review — round 1 (needs-changes, 4 issues)

Reviewer: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context). Inputs: reviewer-prompt.md + anti-gaming-checklist.md, spec B1 sections,
ADR 0003, `git diff 1cd4604..HEAD` (six builder commits + the docs commit 05d076b that landed
during the review). The reviewer re-ran lint/typecheck/unit (39)/rules (34)/agent emulator
("all good")/rules-lint, confirmed the frozen-test diff is empty and the anti-gaming checklist
is clean (no test literals in app code, no suppressions, no sleeps).

Verdict (verbatim):

VERDICT: needs-changes

PROPORTIONALITY:

- Lines added: app 558 (plus 42 docs lines in AGENTS.md/DESIGN.md) / tests 0 since the red checkpoint (715 were added in red commit 1cd4604)
- Duplicated helpers: `legacyStatus` in packages/web/src/lib/legacy-status.ts:8 and `listRank` in packages/agent/src/board.ts:500 make the same decision: needs → waiting, done, `isQueued` → queued, else in progress.
- Harness files added: none

Issues (abridged; the reviewer's full text is in the session transcript):

1. packages/web/src/data.ts approveSpec / setTaskStatus — browser stage writes are plain
   updateDoc with no guard on the current stage (idempotency principle + the spec's
   "transaction guarded on the current stage" contract line); re-queue on for_james writes
   stage undefined; re-queue leaves working: true. Fix: runTransaction guarded on the
   expected stage; guard for_james; clear working.
2. approveSpec posts the approval with needs null → kind 'comment'; before B1 the session
   received 'answer'. Fix: kind 'approve'.
3. packages/agent/src/index.ts workflow instructions step 3 says set spec awaiting_approval
   AND call kanban_ask, which replaces needs {spec} with {question}, hiding the Approve
   affordance. Fix: awaiting_approval only; kanban_ask for real questions.
4. Duplicated classifier legacyStatus (web) / listRank (agent). Fix: one classifier in shared.

Follow-ups the reviewer listed as non-blocking (carried to the PR body):

- Phase 1 documents (no afterDeploy) crash taskStages → kanban_list_tasks, listenForQueued
  and the Phase 1 pages; the Phase 1 data must be deleted before any session loads this
  branch's agent, not just before the web cut-over.
- listenForQueued streams every unbound task incl. done ones; narrow to the first stages.
- kanban_subtask does not check `status` at runtime (unknown value silently no-ops).
- listenForJames clears any need on delivering an 'answer', not just a question.
- Browser may rewrite agent-written ticks (deliveredAt/workingAt/handledAt) via comment update.
- BoardError lacks error_type/request_id per docs/error-schema.md (pre-existing); ask/todo log
  lines include body text (pre-existing).
- Docs nits (fixed by the orchestrator in the follow-up docs commit): broken table row, needs_james
  wording, ADR consequences said the emulator test was deferred, ADR silent on for_james stage.

Orchestrator action: issues 1–4 sent to the builder context for repair; a scoped delta re-review
follows (James's rule: repair what was found, confirm only that).

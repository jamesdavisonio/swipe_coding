# Fresh-context review — final (shippable)

Reviewer: the same fresh Claude subagent context as round 1 (role `verify`,
anthropic/claude-opus-5-5, profile anthropic-only, isolation: context), which never saw the
builder's reasoning. Sequence: round 1 needs-changes (4 issues) → builder fixed 4 in three
commits → scoped re-review: 3 resolved, 1 regression (re-queue guard) → builder fixed in
d2e9166 → scoped confirmation. HEAD at verdict: d2e9166. Frozen-test diff since 1cd4604: empty.

Verdict (verbatim):

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 636 (plus 50 lines of docs in AGENTS.md, DESIGN.md and ADR 0003) / tests 0 since the red checkpoint (715 were added in red commit 1cd4604)
- Duplicated helpers: none
- Harness files added: none

Reviewer's summary of what shipped (verbatim):

> B1 puts the stage model in `packages/shared`, with full test coverage: `stagesFor` and
> `STAGE_LABEL` define each task type's stage chain; `isTaskVisible` hides done tasks after 7
> days; `deliveryState` derives the delivery ticks; `appendLog`, `isQueued`, `stageIndex` and
> `initialTaskFields` complete the contract, and `taskPhase` is now the one classifier. The
> Firestore rules restrict comment kinds on create, freeze `author` and `kind` on update, and
> add `log_archive`; the emulator passes 34 of 34 rules tests. The indexes match the contract.
> The agent's compat mapping matches the spec's "Agent compat in B1" line and passes the
> emulator protocol test. The web pages make only the mechanical adaptation, and James's stage
> transitions now run in transactions guarded on the expected stage, so a double tap writes
> nothing. Every acceptance criterion maps to a frozen test that would fail if the code were
> removed, and the frozen tests were never touched.

Follow-ups the reviewer listed as non-blocking (verbatim headings):

- Delete Phase 1 data first — the agent runs from the repo, so the Phase 1 documents must be
  deleted before any session loads this agent; neither the agent nor the pages guard the old
  document shape.
- `listenForQueued` streams too much — narrow it to the first stage of each chain.
- `kanban_subtask` does not check `status` at runtime — an unknown value succeeds silently.
- Delivery clears more than questions — delivering an `answer` clears any kind of need.
- Agent-written ticks are browser-writable — the comment update rule lets the browser rewrite
  `deliveredAt`, `workingAt`, `handledAt`.
- BoardError lacks the error-schema fields (pre-existing).
- The new web transactions are untested — B4 and B6 tests should run them in the emulator.

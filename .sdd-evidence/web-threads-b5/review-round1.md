# web-threads B5 — fresh-context review, round 1 (claude-opus, fresh context)

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 1228 (783 deleted, net +445, all under packages/web/src; much is moved code from the refactors and the retired Phase 1 pages) / tests 2119 (all in red commit ae097d1; 0 since)
- Duplicated helpers: none in application code (shared pieces extracted: ProjectTile initials, liveProjectIds, ScreenState); one near-duplicate expression (follow-up 4)
- Harness files added: none

Criteria 21–24, 29, 30 each mapped to failing-if-removed tests; writes match the contract (createTask one batch with the project touch; addTodo trim/cap/blank refusal; rules accept both); windows from isAgentOnline / AGENT_STALE_MS and isTaskVisible / DONE_VISIBLE_MS; queue line not stored; logging conforms; anti-gaming clean (tests unchanged since red; no suppressions; the removed `.catch(() => {})` in touchProject is gone). Evidence on ea5763e: npm test 35 files / 386; test:rules 11 files / 95; lint 0; typecheck clean; build ok; contrast 38 pairs.

Judgements: sign-out lost with the Phase 1 TopBar is not a spec regression (pages retired by contract; no sign-out in spec or prototype) but a lost Phase 1 capability → James's list. createTask rejecting on a missing project doc cannot bite in normal use (agents create the project before any task).

Minor follow-ups (not blocking): 1 sign-out control; 2 offline New task waits for server ack (optimistic navigation later); 3 orphan `<Field label="Type">` label (NewTaskForm.tsx:259); 4 emptyThreadText re-derives isQueued; 5 blank-input rejections log feature_error, validation_failed would fit better; 6 no emulator test of the project updatedAt touch; 7 TASKS comment overclaims (test-only); 8 online fixture agents at a third of the stale window.

Orchestrator: follow-up 3 sent to the builder (scoped re-check); 1 goes to James's For James list; the rest go to the PR body.

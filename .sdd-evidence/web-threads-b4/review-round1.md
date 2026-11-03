# web-threads B4 — fresh-context review, round 1 (claude-opus, fresh context)

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 554 (44 deleted; 11 files under packages/web/src) / tests 0 since red (the red checkpoint 9413961 added 2,181 test lines)
- Duplicated helpers: none that block (cleanText repeats an inline trim + cap; consolidation candidate)
- Harness files added: none

Evidence the reviewer ran on HEAD df29b9f: npm test 29 files / 282 passed; npm run test:rules (emulator) 8 files / 80 passed; typecheck clean; lint 0 errors (2 pre-existing autoFocus warnings); build ok; contrast 38 pairs AA. Anti-gaming checklist A–E clean. Criteria 16–20, 28 tick half, 29 sheet failure state, 30 on the sheet each mapped to failing-if-removed tests. Principles io-validation, idempotency, traceability, observability, graceful-degradation, error-schema applied with line references.

Minor follow-ups (not blocking):

1. ADR 0003 still describes after-deploy completion as a guarded transaction and a hard 200 cap; tickStep is a batch whose arrayUnion can pass the cap until the next transactional write. Amend the ADR.
2. tickStep overwrites the whole afterDone array from the screen's view: concurrent ticks from two devices can drop one; a stale screen can re-complete a done task. A rules-level stage check would close the stale case.
3. A completing tick that later fails cannot show its alert (latency compensation closes the sheet first); the rejection is only logged.
4. requestChange caps at 4000, then jamesComment caps `Change: <text>` again, losing 8 characters in the message.
5. key={step} / key={point} collide on repeated text.
6. After a successful decision focus returns to a trigger that may have unmounted.
7. Optional consolidation of the trim + cap helper and the afterDeploy array guard.

Orchestrator: follow-ups 4 and 5 sent to the builder; 1 handled in update-docs; 2, 3, 6, 7 go to the PR body.

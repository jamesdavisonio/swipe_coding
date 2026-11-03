# web-threads B3 — fresh-context review, round 1 (claude-opus, fresh context)

VERDICT: needs-changes

PROPORTIONALITY: app 863 lines added (27 files under packages/web/src; 411 deleted, 330 of
them pages/Task.tsx) / tests 0 since red (red checkpoint added 1541 test lines in 8 files).
Duplicated helpers: pendingComment (lib/messages.ts:55-71) duplicates jamesComment
(data.ts:206-220). Harness files added: none.

Issue 1: duplicated application helper — the optimistic message and the written comment are
built by two copies that already drifted (pending copy always kind `comment`, no trim/cap).
Fix: one pure builder in lib/, plus a replyKind(task) helper used by sendReply and useReply.

Walked and passing: anti-gaming A–C; sendReply batch writes exactly the contract and the rules
allow it; offline persistence correct with the emulator path kept (hot-reload double-init risk
confirmed real, dev only); optimistic message keyed by id with a fresh id per send; removal of
Task.tsx/addComment/setTaskStatus/useAgent/AgentDot in scope and unreferenced; logging conforms
(api_call_failed action mark_read acceptable); principles; criteria 13–15, 2, 28 (reply half),
29, 30 each mapped to tests. npm test 205 passed; lint 0 errors; typecheck clean; build ok;
contrast 38 pairs.

Non-blocking follow-ups: guard firebase.ts against dev hot re-run; memory cache under the
emulator; Phase 1 Mark done / Re-queue / resume copy no longer offered (DESIGN.md:155 still
describes the resume hand-off); ThreadFooter shows quick replies before the Done note if a done
task still has a need; Messages.tsx has no string guard on body; bubble widths use arbitrary
percentages; markRead can fire twice from Threads (idempotent).

Orchestrator: issue 1 plus the firebase.ts guard and the body guard sent to the builder; the
rest go to the PR body; DESIGN.md reconciled in update-docs.

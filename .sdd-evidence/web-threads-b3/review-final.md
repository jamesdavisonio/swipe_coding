# web-threads B3 — fresh-context review, final (scoped re-review of the three fixes)

VERDICT: shippable

Scoped re-check of 949665c..HEAD (22db150, d91f6ec, c2b1e64). `git diff 0bcf6d2..HEAD -- tests/` still empty.

1. Issue 1, duplicated comment builder (22db150) — RESOLVED. One jamesComment(task, kind, body, at, id) in lib/messages.ts with trim and 4000 cap; replyKind(task) beside it; data.ts transitionTask and sendReply use it; use-reply builds the optimistic copy with jamesComment(task, replyKind(task), body, Date.now(), id). Old builders deleted.
2. Follow-up, firebase.ts hot update (d91f6ec) — RESOLVED. openFirestore() catches only FirebaseError failed-precondition and falls back to getFirestore(app); verified in Node that two calls return the same instance with the emulator connection kept.
3. Follow-up, malformed body (c2b1e64) — RESOLVED. bodyText(comment) returns '' for a non-string body; all three renderers use it.

npm test 22 files / 205 passed; lint 0 errors; typecheck clean; build ok.

PROPORTIONALITY (full diff since 0bcf6d2):

- Lines added: app 897 / tests 0 since red (the red checkpoint added 1541 test lines)
- Duplicated helpers: none
- Harness files added: none

Still open (PR body): persistent cache keeps data across emulator resets; Mark done / Re-queue / resume copy / task description gone (DESIGN.md reconciled in 5e23cec); quick-reply chips before the Done note on a done task with a need; bubble widths use arbitrary percentages; markRead may fire twice from Threads (harmless).

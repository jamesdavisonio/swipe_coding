# web-threads B2 — fresh-context review, final (scoped re-review of the four fixes)

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 1115 (whole diff since 0e803d0, package-lock.json not counted; the four fix commits add 26 of these) / tests 0 since the red checkpoint
- Duplicated helpers: none
- Harness files added: none

Commands run on HEAD 3f2c740: `git diff 0e803d0..HEAD -- tests/` empty, tree clean; npm test 15 files / 120 tests pass; lint 0 errors (2 pre-existing autoFocus warnings); typecheck pass; build:web pass.

1. Issue 1, logger environment (9b5f507) — resolved. appManifest plugin maps config.mode production → prod, else dev; bundle carries env:"prod"; tests mock log.ts.
2. Issue 2, failed writes (04f8275) — resolved. Firestore errors log api_call_failed with feature, action, request_id, target firestore, status err.code; others feature_error. Nit: any FirebaseError would be tagged target firestore; only Firestore writes run there today.
3. Follow-up, chip focus ring (9443c9c) — resolved. Scroller -m-1 p-1 gives the 2px ring + 2px offset room; no horizontal page scroll. Not seen on a device.
4. Follow-up, ThreadRow missing updatedAt (3f2c740) — resolved. isDateable guard; valid timestamps unchanged.

Still open (PR body): answerQuestion does not check the option belongs to the current question; a failed write shows James nothing (criterion 28); Home bottom padding under the fixed nav; retry() shows no progress; vendored logger's session_start has no feature.

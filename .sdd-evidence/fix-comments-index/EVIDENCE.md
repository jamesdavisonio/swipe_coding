# fix-comments-index — evidence (fix → implement-feature, class Small)

Fix spec: the red-checkpoint commit message (`git show -s 55307c0`), confirmed by James ("fix
confirmed", 2026-11-05, in the session, including deploying the indexes) · Branch
`fix/comments-index` · Red SHA `55307c0f0d0690adeaa8746a3d3cf910ea3a0cb5` · Board task
`e4TVaHExTLmHvPCFsIcH`.

Root cause: `Board.getComments` (kanban_get_task) needs comments (taskId ASC, createdAt DESC);
the index was never declared in `firestore.indexes.json` (not even in Phase 1), was created by
hand, and was removed with the undeclared indexes on 2026-11-03. Live symptom on 2026-11-05:
`9 FAILED_PRECONDITION: The query requires an index`. The emulator does not enforce composite
indexes, so the repro checks the declaration.

1. Commits since red: `be8e34f fix(firebase): declare the comments index kanban_get_task needs`.
2. `git diff 55307c0..HEAD -- tests/` → empty (Tier A hook armed at 55307c0).
3. Outputs: red — `tests/fix-comments-index.test.ts` 1 failed, 5 passed; green — 6/6; `npm test`
   52 files / 538 passed; lint 0 errors; typecheck clean; prettier clean (builder and reviewer).
4. Test authorship: the repro was written by the debug hop (orchestrator, role `plan`).
   Profile `anthropic-only (context)` — debug: claude-opus-5-5 / build: claude-sonnet (fresh
   context) / reviewer: claude-opus-5-5 (fresh context).
5. Reviewer: **VERDICT: shippable** — one 14-line config entry; the other 7 indexes
   byte-identical; independent audit of every agent and web query found no other missing
   composite index. Follow-ups: tasks (projectId, doneAt DESC) and todos (projectId, done,
   createdAt ASC) have no query in agent/src or web/src/data.ts (prune only if confirmed dead).

# web-threads B2 — fresh-context review, round 1 (claude-opus, fresh context)

VERDICT: needs-changes

PROPORTIONALITY: app 1089 lines added (1060 in packages/web/src) / tests 0 since red (red
checkpoint added 1313 test lines). Duplicated helpers: none (relativeTime vs timeAgo differ in
output; relativeTime ports the prototype's rel()). Harness files added: none.

Evidence the reviewer ran: tests diff since red empty; npm test 120 passed; lint 0 errors (2
pre-existing autofocus warnings); typecheck pass; build:web pass; contrast 38 pairs AA.
Anti-gaming checklist A–C: no markers. Criteria 6–12, 29, 30 each mapped to failing-if-removed
tests. Data layer guarded and idempotent per contract; nothing beyond B2 scope.

Issues:

1. packages/web/src/lib/log.ts:11 — browser logger always reports env 'prod' (manifest has no
   env; log.ts passes none). Fix: export env from the Vite appManifest plugin from config.mode.
2. packages/web/src/lib/use-thread-actions.ts:23-27 — failed Firestore write logged as
   feature_error with status err.name ('FirebaseError'). Fix: api_call_failed with target
   firestore, action, status err.code, request_id.

Non-blocking follow-ups: answerQuestion should also check option.key is still in
needs.options; ProjectChips focus ring likely clipped by the scroller; ThreadRow
toISOString throws without updatedAt; failed quick-reply write gives no UI feedback (criterion
28); /projects Home bottom padding under the fixed nav; retry() keeps the error state until a
snapshot; vendored logger's session_start has no feature key.

Orchestrator: issues 1–2 plus follow-ups 2–3 (focus ring, date guard) sent back to the builder;
the rest go to the PR body.

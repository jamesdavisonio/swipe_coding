# app-logs L1 — fresh-context review (claude-opus, fresh context)

Review 1 (`ff17581..71af173`): **needs-changes**, one issue (`review-1-summary.md`): a failed store
kept its claimed slot in the per-minute cap, so failed writes counted towards the 20 stored
events per minute.

Fix: `43e98bb fix(agent): give the per-minute slot back when storing a log fails`, made by the
builder (fresh context) from the reviewer's finding; plus a comment-only fix in
`packages/web/src/ambient.d.ts`.

Scoped re-review of `43e98bb`, the reviewer's verdict as returned:

VERDICT: shippable

Issue 1 is fixed by commit 43e98bb, `packages/agent/src/app-log.ts:131-134`. A failed store now
gives back its own slot, so only events that were actually stored count toward the limit of 20
per minute.

- How the fix works: in the catch, `storedAt.lastIndexOf(now)` finds the slot and `splice`
  removes it. The `!== -1` check covers the case where the slot has already rolled out of the
  window.
- No overshoot: the claim still happens synchronously before the `await`, so concurrent calls
  cannot go over the limit.
- Collisions are harmless: if another call stored in the same millisecond, the entries hold the
  same value. Removing either one leaves the window count correct.
- Cap-refused attempts: these still never take a slot.
- Nothing to recurse: the catch writes only to stderr, so nothing can loop.

The commit adds no new problems: it touches only that catch block and the wording of the
comment in `packages/web/src/ambient.d.ts` (closing the stale-comment follow-up); no test files
changed (`git diff ff17581..HEAD -- tests/` is empty); no gaming markers; no acceptance
criterion affected.

Test results after the fix: `npx vitest run` 51 files / 532 passed; `npm run typecheck` clean;
`npm run test:rules` (JDK 21) 28 files / 227 passed, including L1-7 and L1-8.

Remaining non-blocking follow-ups:

1. `log-store.ts`: an `undefined` value in an event's context makes the whole batch (up to 21
   events) drop silently; no current call site does this (strip `undefined` in
   `boundedLogFields`).
2. When registration keeps failing, each tool call stores two events (a registration error and a
   `feature_error`); the cap bounds it.
3. James still needs two todos: the full TTL command, and the logger `transport` change for the
   skills repo template.
4. Style: the heartbeat site in `board.ts` builds its own `logFailure` call where
   `firestoreFailure` would do; `LogEvent` in `tests/fixtures/app-logs.ts` mirrors `LoggerEvent`.

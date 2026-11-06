# Evidence — board-replies-anywhere R1 (board replies reach every session)

Spec: `docs/features/board-replies-anywhere.md` (confirmed by James, 2026-11-06, "spec confirmed").
Branch `feat/board-replies-anywhere`. Red checkpoint `faf4aa8b0916d6fa900f24b45b57360324f133e0`.
Profile: anthropic-only (context isolation) — test author: Opus (fresh context) / fidelity
checker: Opus (fresh context, two contexts: full audit, then delta) / implementer: Sonnet (fresh
context) / reviewer: Opus (fresh contexts: full review, then two scoped re-reviews).
Prompt grounding: the test author and checker received `packet-test-author.md` (rules verbatim,
spec verbatim, observed sources at `2ebcff5`); the builder received `builder-brief.md`. Neither
the builder nor the reviewers saw the fidelity verdicts.

## 1. Commits since the red checkpoint

```
027bfc2 test: amend three older tests to watcher delivery (approved by James)
6f5729c docs(spec): the watcher prints every James comment kind
f4c1982 fix(agent): only one watcher claim in flight at a time
6d1e84c docs: replies reach sessions through the watcher (ADR 0005)
9ea798d fix(agent): a failing watcher never loses a claimed reply; claim checks the session
bdcf90d refactor(agent): split the watcher into session, replies and claim steps
effd923 feat(agent): replies reach every session through a watcher
```

## 2. Test files since the red checkpoint

The frozen R1 files (`tests/emulator/board-replies-anywhere-r1-*.test.ts`,
`tests/fixtures/board-replies-anywhere-emulator.ts`) are unchanged since `faf4aa8`.

One approved amendment, `027bfc2`, changes three older tests that asserted the channel delivery
this spec removes (criteria 8 and 10). James approved it on 2026-11-06 ("Yes you can change them"):

```
 packages/agent/test/protocol.ts   | 69 ++++++++++++++++++++++++---------------
 tests/board-briefs-b7-37.test.ts  |  6 ++--
 tests/emulator/app-logs-6.test.ts | 43 ++----------------------
```

- B7-37: the instructions must mention the watcher instead of `from="james"`.
- app-logs-6: the "failed channel delivery" case is removed; R1-7 covers the watcher's failures.
- Agent protocol test: the reply and the answer arrive through the watcher command from the
  `kanban_create_task` result; `deliveredAt` is null before and set after; no channel event.

## 3. Checks (final run on 027bfc2; full tails in `checks/`)

```
lint        PASS exit 0 (0 errors; pre-existing non-null-assertion warnings)
typecheck   PASS exit 0
unit tests  PASS exit 0 (52 files, 538 tests)
build       PASS exit 0 (npm run build:web)
integration PASS exit 0 (test:rules 39 files / 274 tests, incl. 42 R1 tests; no "Channel closed")
agent       PASS exit 0 (protocol test on the emulator, through the watcher)
prettier    PASS exit 0
rules lint  PASS exit 0
secrets     PASS 0 hits in the added lines
stray       PASS no .only / debugger / console.log in the changed source
```

Red → green: the ten R1 files went from 42 failed (only those; 233 others passed) to 42 passed.

## 4. Test fidelity

Round 1 (full audit): FAIL, six gaps — r1-6 a losing watcher could exit 0 empty; r1-9 the tool
could mark non-answer comments, and could accept any non-null need; r1-5 a vacuous needs check;
r1-7 two failure paths without the warning assertion; r1-9 author not exact. Gaming flags: a
watcher that loses every claim exits 0 with no output; the tool marks every pending James
comment; the tool accepts any non-null need.

Delta round 1 (fresh context, only those gaps), verbatim:

```json
{
  "verdict": "PASS",
  "gaps": [
    {
      "n": 1,
      "closed": true,
      "why": "r1-6 line 55 asserts every exited watcher run (including the fallback third) printed at least one line; an empty exit-0 loser fails it"
    },
    {
      "n": 2,
      "closed": true,
      "why": "r1-9 seeds a pending James comment, asserts deliveredAt stays null after the tool, and a later watcher prints it together with a newer comment and nothing else"
    },
    {
      "n": 3,
      "closed": true,
      "why": "r1-9 adds needs {kind:'spec'} via kanban_subtask awaiting_approval (board.ts sets exactly that), expects an error starting 'no open question' and needs unchanged"
    },
    {
      "n": 4,
      "closed": true,
      "why": "r1-5 asserts needs equals QUESTION while the answer waits (line 34) and null after the next watcher prints it (line 40)"
    },
    {
      "n": 5,
      "closed": true,
      "why": "r1-7 offline asserts stderr contains 'api_call_failed WARNING' (logFailure's log line in app-log.ts:123); while-waiting asserts a stored WARNING api_call_failed, source server, context target watcher and status shut_down, since the test began"
    },
    { "n": 6, "closed": true, "why": "r1-9 line 65 expects note.author toBe 'agent'" }
  ],
  "gaming_flags": [
    {
      "flag": "a",
      "caught_by": "r1-6 (both cases), line 55; caught only when a watcher actually loses every claim in that run, which depends on timing"
    },
    {
      "flag": "b",
      "caught_by": "r1-9 'clears the question, posts the session message, and no watcher prints the board answer' (line 68 and the watcher's exact output)"
    },
    { "flag": "c", "caught_by": "r1-9 'refuses a task that waits on the spec, not a question'" }
  ],
  "new_gaps": []
}
```

## 5. Fresh-context review

- Full review of `faf4aa8..bdcf90d`: `VERDICT: needs-changes` — MEDIUM: `fail()` awaited a log write
  while a claim could commit `deliveredAt`, so a reply could be marked received and never printed
  (criterion 4). LOWs folded in: claim re-checks `agentId`; instruction wording; instructions list
  every James comment kind.
- Scoped re-review of `9ea798d`: all four closed; new MEDIUM regression — clearing `settling` at
  the start of a claim let two claims overlap. `VERDICT: needs-changes`.
- Scoped re-review of `f4c1982`: closed, every interleaving walked through, no new findings.
  `VERDICT: shippable`.

Open, not blocking (reviewer LOW/INFO): a watcher whose agent crashes without shutting down waits
until the session ends; the waiting answers in `kanban_answered_in_session` are read outside its
batch (tiny window); a transaction that commits but reports an error would mark replies without
printing them; the watcher command uses a bare `node` and a double-quoted path.

## Incident during this feature

At 06:47:50–06:48:00 UTC a helper agent ran the R1 test files without the Firestore emulator.
The fixture's direct database handle (`getDb()`) fell back to the real service-account key and
seeded 44 documents (12 agents, 17 tasks, 15 comments, all `replies-r1-*`) on the live board.
No real document was changed; the watchers refused to start without the emulator. James has the
cleanup command; the root cause (the board connection uses the real key under the test runner)
is a separate fix.

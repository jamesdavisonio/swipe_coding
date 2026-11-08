# Evidence: decision-notifications (criteria 71–88)

Spec: `docs/features/decision-notifications.md`, confirmed by James on the board on 2026-11-08 at
05:41 ("Approved spec v1"; the yes line was "Start building notifications for decision cards").
The spec was drafted in an earlier session that could not hear the board; this session took the
task over after James had it stop the old session's agent.

Profile: anthropic-only (isolation: context). Test authors: two isolated Sonnet contexts (77–83,
87, 88: agent, shared, rules, hosting; 71–76, 84–86: web, service worker, deck). Fidelity
checker: an isolated Opus context, and a fresh Opus context for each delta. Implementer: an
isolated Opus context, without the fidelity verdicts, and a fresh Opus context for the review
repair. Reviewer: a fresh Opus context, and a fresh Opus context for the scoped re-review.

Before red: `168f2a6` (spec confirmed), `5d7ff3a` (contract detail before the test draft:
interfaces, strings, and the log context `target`/`status` the taxonomy requires instead of the
table's `service`/`error_code`), `9846030` (signature-only stubs so the red tests fail on
behaviour; the contract also says `fcmPush` sends nothing against the emulator).

## 1. Commits since the red checkpoint (`13fdde6`)

```
6512a1f fix(decision-notifications): reuse the stored device id; guard errorStatus
32d21b1 feat(decision-notifications): phone notifications for decision cards
```

Plus this evidence, the ADR and the AGENTS.md line in the final docs commit.

## 2. Test changes after red

None. `git diff 13fdde6..HEAD -- tests` is empty. The Claude Code read-only hook was armed on
`13fdde6` for this worktree; its command resolves through `$CLAUDE_PROJECT_DIR`, which for this
session was the main checkout, so it may not have guarded the worktree. The diff gate above is
the proof.

## 3. Checks on `6512a1f` (outputs in `checks/`)

- `npx vitest run`: 93 files, 860 tests passed, exit 0 (`checks/unit.txt`).
- `npm run test:rules` form (emulator, `vitest.rules.config.ts`): 56 files, 393 tests passed,
  exit 0 (`checks/emulator.txt`).
- `npm run test:agent`: "all good" offline (`checks/agent.txt`) and on the emulator
  (`checks/agent-emulator.txt`).
- `npm run typecheck`: exit 0. `npm run lint`: 0 errors, 19 warnings, all non-null assertions in
  `tests/**` and `packages/agent/test/protocol.ts`, none in this change. Firestore rules lint:
  passed. `npm run build:web`: built, `dist/sw.js` present (Vite warns the main chunk is over
  500 kB).
- Red run (`13fdde6` on the stubs): unit 78 of 99 new tests failed, emulator and rules 29 of 63
  failed, every one on missing behaviour (no switch, no worker handlers, nothing sent, no
  warning stored, dead tokens kept, device writes refused by absent rules). The 21 unit and 34
  emulator tests that passed at red are regression guards (existing headers, usual deck order)
  and negative cases a do-nothing stub satisfies (rules refusals, silence for 79 and 81), each
  paired with failing positive tests in the same criterion.
- Test lines (2124, in the red commit) exceed new application lines (about 880, of which about
  190 are the brief parser moved to shared): the agent behaviour is proven against the emulator
  and the shared derivation against the real deck builder, which needs tables of cases, and the
  rules suite enumerates every refused shape.

## 4. Fidelity gate

Round 1 (full audit of the combined drafts): FAIL, 6 gaps and 1 gaming flag. Gaps: the
"Chrome already blocking" fake resolved `granted`; seeded devices were never cleared between
emulator files; the after-deploy silence test did not prove the stage was reached; the
`createdAt kept` check could pass within one millisecond; the `waitUntil` test only saw some
promise; negative log counts read before a late warning could land. Gaming flag: a worker calling
`waitUntil(Promise.resolve())` and showing the notification outside it passed test 84.

Delta round 1: PASS — `"gaps": []`, `"gaming_flags": []`, all criteria 71–88 mapped. Notes it
passed to the reviewer: a device record left by emulator test 76 (answered by the contract's
no-send-against-the-emulator rule), the log barrier's reliance on send order, and that a
deliberately timed `waitUntil` cannot be ruled out by one probe.

## 5. Fresh-context review

First review: **shippable**. Every principle walked (rules and zod at each input boundary, one
record per browser and one tag per task, a send that never fails the tool call, taxonomy events
with `target`/`status`/`task_id`). Accepted the implementer's three additions: the messaging
sender id derived from the app id, `getToken` before `deleteToken` so Firebase never registers
its default worker, and the open-task message only when the url carries a task. Non-blocking
follow-ups: (1) `enablePush` minted a new id even with one stored; (2) `errorStatus` could throw
on a `null` rejection; (3) an invalid push may surface Chrome's generic notice; (4) `?task=`
stays in the URL after the card is handled; (5) a failed turn-off shows no line; (6) emulator
suites not re-run by the reviewer (run here, item 3).

Items 1 and 2 were repaired in `6512a1f` by a fresh implementer. Scoped re-review:
**shippable** — both resolved, no tests touched, no regression; it notes no test covers reusing
the stored id on a second enable (tests are frozen).

## Not verified

Not tried on James's phone or in a real Chrome: the board is behind Google sign-in and a real
push needs the VAPID key and the service account's FCM send permission (spec hand-over).

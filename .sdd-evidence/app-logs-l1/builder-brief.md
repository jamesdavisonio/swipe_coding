# Builder brief — app-logs L1 (store and read app logs)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/app-logs`.
Red-checkpoint SHA: `ff175813394d51a09d618bf1e4740b53055287ea` (commit `test(app-logs): red checkpoint for app logs Claude can read`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

## Builder rules (verbatim from the skill set)

> For `codex-only`, report suspected frozen-test defects to the coordinator and pause only dependent implementation. Do not edit the tests or ask the owner directly. The coordinator uses independent author/checker amendment review within the remaining three-round allowance; owner decisions are required for exhausted allowances or genuine contract/access changes. The packet's Codex correction and reporting rules override the portable stop-and-ask wording below. Return compact results to the coordinator; routine retries and worker updates stay in evidence.
>
> Given verbatim to the implementer in its packet and printed at the top of steps 4 and 5 of `implement-feature`. The implementer receives these rules, the confirmed spec, the red-checkpoint test files and red SHA, the repo, the principles the spec lists and `instrument/taxonomy.json` — never the interview transcript, the plan discussion, the fidelity verdict, or `SKILL.md`.
>
> ### Implementation rules
>
> - Validation uses the project's schema library when present (`zod` is in this repo's `package.json`). Hand-rolled object/date/enum validators are not acceptable when the library covers them.
> - Before writing a helper, grep for an existing one. Duplicating a function that exists in `lib/` or `app/server/` fails the refactor gate.
> - Route handlers (`app/api/**/route.ts`) hold parsing, auth and response shaping only; business logic goes in `app/server/` or `lib/`. A route file may not grow by more than 200 lines per feature.
>
> Apply the principles the spec identified (from `_principles/`). Do not write code that receives external input without following `_principles/io-validation.md`. Do not call an AI without following `_principles/ai-sandboxing.md` and `_principles/gating.md`. Do not write to storage or external services without following `_principles/idempotency.md`.
>
> Before instrumenting, read `instrument/SKILL.md` and `instrument/taxonomy.json`. All logging goes through the shared logger (no `console.log`, no ad-hoc log JSON); every `event_type` comes from the vendored taxonomy per rules R1–R3; instrumentation rules are in `instrument/references/instrumentation.md`.
>
> ### Never
>
> - Modify a test file. If a test seems wrong, STOP and ask the human.
> - Add `.only`, `.skip`, `xfail`, widen tolerances, add sleeps, or add retries to mask flakiness.
> - Hardcode or special-case test inputs in implementation code. No `if input === "the-test-value"`.
> - Suppress errors to make things pass: no `try { … } catch {}`, no `@ts-ignore`, no `as any`, no inline `eslint-disable`.
> - If spec and tests conflict, surface the conflict. Don't silently satisfy either.
>
> ### Anti-gaming rules (repeated because they matter)
>
> - Never modify, delete, skip, or weaken a test to make it pass. If a test seems wrong, STOP and ask.
> - Never `.only`/`.skip`/`xfail`, widen tolerances, or add sleeps/retries to mask flakiness.
> - Never hardcode or special-case test inputs in implementation code.
> - Never suppress errors to make checks pass — no swallowing exceptions, no `@ts-ignore`, no `as any`, no inline lint-disable.
> - If spec and tests conflict, surface the conflict. Do not silently satisfy either.
> - Report verification evidence verbatim (command + output). Never summarise a result you did not run.

Repo-specific notes on those rules: this repo has no `zod` (validate with plain TypeScript narrowing and the shared types), no `app/api`, and no `_principles/` or `instrument/` folder on this machine — the principles are spelled out in the spec's "Principles that apply" section, and the instrumentation rules in its "Instrumentation" section plus `docs/logging.md`. The shared browser logger is `logging/logger.browser.js`; event types come from `logging/taxonomy.json`. Never edit anything under `logging/` (governed, vendored files).

## What to read (and nothing else outside the repo)

1. `docs/features/app-logs.md`, all of it. Pay most attention to these parts:
   - "L1 — Store and read app logs" (criteria 1–12)
   - "L1 contract details fixed at test time"
   - "Test-draft decisions (L1)"
   - "Principles that apply" and "Instrumentation"
2. The frozen tests (read-only):
   - `tests/app-logs-*.test.ts`
   - `tests/emulator/app-logs-*.test.ts`
   - `tests/rules/app-logs-5.rules.test.ts`
   - the fixtures `tests/fixtures/app-logs.ts` and `tests/fixtures/app-logs-emulator.ts`

   Everything earlier must stay green.

3. The code L1 changes and reuses:
   - `logging/logger.browser.js`, and `packages/web/src/lib/log.ts` (plus any ambient types it uses)
   - `packages/web/src/firebase.ts`
   - `packages/agent/src/firestore.ts` (`log`, `getDb`, `boardStatus`)
   - `packages/agent/src/board.ts` (register, heartbeat, the listeners, delivery, announce)
   - `packages/agent/src/index.ts` (the tools list and the tool-call catch)
   - `packages/agent/src/instructions.ts`
   - `packages/shared/src/index.ts`
   - `firestore.rules`, `app.manifest.yaml`, `logging/taxonomy.json`, `logging/pii-keys.json`
   - `packages/agent/test/protocol.ts`, to see how the agent is spawned offline
4. Conventions: `AGENTS.md`, `docs/logging.md`, `docs/error-schema.md`.
5. Edit targets:
   - `logging/logger.browser.js`: the optional `transport`, exactly as the contract says. Change nothing else in it. It is the one vendored logger file this feature may change; `taxonomy.json`, `context-keys.json` and `pii-keys.json` stay read-only.
   - New `packages/web/src/lib/log-store.ts`, wired as the transport in `lib/log.ts`.
   - New `packages/agent/src/app-log.ts` (`logFailure`, `readLogs`), the `kanban_logs` tool in `index.ts`, and the failure sites in the contract's table.
   - `packages/agent/src/instructions.ts`: the `kanban_logs` line.
   - `packages/shared/src/index.ts`: the constants.
   - `firestore.rules`: the `logs` match.
   - `firestore.indexes.json`: only if a query you write needs a composite index.
   - The agent's `package.json`, only if you need a YAML parser there (the web package already uses `yaml`).

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

L1 only, exactly as the contract says:

- **Browser logger transport:** optional `transport(events)`, used instead of fetch/sendBeacon whether or not `log_endpoint` is set.
  - A rejected transport is retried with the existing bound and backoff.
  - On the hide/pagehide path it is called once and not awaited.
  - Without a transport, the logger behaves exactly as today.
- **Web store** (`storeLogEvents`):
  - Signed in means `auth.currentUser` is set at the moment of the call. Signed out writes nothing.
  - Writes the 18-field stored event, one per input event, in one batch.
  - Truncates the message and context values and caps the context keys.
  - Sets `request_id` only from a string `context.request_id`, otherwise `null`.
  - Sets `expireAt` as a Firestore Timestamp.
  - Resolves once the batch is handed over, without waiting for the server. A failed commit is swallowed silently, never logged, and it never rejects.
- **Rules:** the `logs` match exactly as the contract lists it. No read, update or delete, ever.
- **Agent `logFailure`:**
  - Always writes one `log()` line.
  - Stores at most `AGENT_LOG_MAX_PER_MINUTE` events in any rolling 60 seconds, measured with `Date.now()`.
  - Takes identity from the board registration.
  - Reads `app.manifest.yaml` and `taxonomy.json` relative to its own file.
  - A failed store writes one more `log()` line and nothing else. It never rejects and never recurses.
  - It stores through ordinary document writes (`add`/`set`/`create`, which go through `WriteBatch.commit`), not BulkWriter or a transaction.
- **Failure sites:** every row of the contract's table calls `logFailure` with the severity, event type and context it lists. The existing `log()` lines stay.
- **`kanban_logs`:**
  - Its arguments, defaults, bounds, ordering, the `LOGS_SCAN_MAX` scan and the result shape follow the contract.
  - An invalid value or an unknown argument gives a tool error starting `invalid <name>`.
  - It works whether or not the session has a task.
- **Instructions:** one line telling sessions to read `kanban_logs` before asking James to reproduce a board problem. Everything else stays.
- **Out of scope:** BigQuery, alerting, any UI, and logging the agent's ordinary progress lines.

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`, and never point `KANBAN_SA` at a key file. The emulator (`npm run test:rules`) is the only Firestore you use.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: every earlier test plus the L1 unit tests, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # rules + all emulator suites, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

## Working method

- Start by running `npx vitest run tests/app-logs` and the emulator suite to see the red yourself.
- Implement the minimal code that turns them green. Run after every meaningful change and report the counts going from red to green. Keep everything earlier green throughout, including the agent protocol test.
- Commit as you go in logical conventional commits, using the repo's scopes (`feat(web): …`, `feat(agent): …`, `feat(rules): …`, `feat(logging): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- If a frozen test seems impossible to satisfy or wrong, stop and report it with evidence. Never edit it, and never game it.
- After green, do the refactor step and report it as a checklist with evidence:
  - duplicates removed (list)
  - helpers reused (list)
  - any function over 50 lines or nesting over 4 split
  - constants named
  - no suppressed error paths (every swallow has a reason comment)
  - line counts of `app-log.ts`, `log-store.ts`, `board.ts` and `index.ts`

  Then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline ff17581..HEAD`.
2. `git diff ff17581..HEAD --stat`, and confirmation that `git diff ff17581..HEAD -- tests/` is empty.
3. Verbatim command and tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. What changed in the logger, the rules and each failure site, and what `kanban_logs` does.
7. Anything where the spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

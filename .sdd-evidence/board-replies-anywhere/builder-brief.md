# Builder brief — board-replies-anywhere R1 (replies through a watcher)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/board-replies-anywhere`.
Red-checkpoint SHA: `faf4aa8b0916d6fa900f24b45b57360324f133e0` (commit `test(board-replies-anywhere): red checkpoint …`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. The confirmed spec: `docs/features/board-replies-anywhere.md`, especially "R1 contract details fixed at test time" (exact names, output lines, exit codes, failure lines, the new tool).
2. The frozen tests (read-only): `tests/emulator/board-replies-anywhere-r1-*.test.ts` and `tests/fixtures/board-replies-anywhere-emulator.ts`.
3. The code: `packages/agent/src/{firestore.ts,board.ts,index.ts,instructions.ts,app-log.ts}`, `packages/shared/src/index.ts`. Background: `docs/architecture.md`, `docs/logging.md`, `logging/taxonomy.json` (event types only from there; logging goes through `logFailure` / `log()`).

Do not read or create anything under `.sdd-evidence/`. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

- New `packages/agent/src/wait.ts` (the watcher; an entry point that exits with the contract's codes; diagnostics on stderr, only the contract lines on stdout). It reuses `firestore.ts` and `app-log.ts`, and the claim logic lives in `board.ts` next to today's `markDelivered` question rule so the rule is written once.
- `WATCHER_SETTLE_MS` in `packages/shared/src/index.ts`.
- `packages/agent/src/index.ts` and `board.ts`: the `watcher` field on the `kanban_create_task` / `kanban_start_task` results; the agent stops pushing and marking James's comments (remove the reply listener rather than leaving it dead); queued announcements unchanged; the new tool `kanban_answered_in_session`; the `kanban_ask` description and result note.
- `packages/agent/src/instructions.ts` per the contract's Instructions bullet. Keep the text plain and phone-short like the rest; keep every other rule in it.
- Nothing else changes: no web app, rules or index changes are expected (the existing composite index `comments (agentId, deliveredAt, createdAt)` serves the watcher query). If you find you need one, stop and say why in your report instead of adding it.
- Nothing you do may touch the live Firestore project: never set `KANBAN_TEST_LIVE`, never point `KANBAN_SA` at a key file, never read `..\kanban-secrets`.

## Whole-repo green

All of these must pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck
npm test
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"
npx prettier --check .
```

`npm run test:agent` (packages/agent/test/protocol.ts) is not a frozen acceptance test; if it asserts the old channel delivery, update it to the new contract and say so in the report. If `test:rules` ends with a vitest worker crash ("Channel closed") and no failing test, that is a known flaky harness issue: run it again and report both runs.

## Working method

- Run the suite first to see it red: 42 failed in the ten `board-replies-anywhere-r1-*` files, 233 passed.
- Implement minimally, re-running the R1 files as you go. Report red → green counts.
- Commit in small steps with conventional messages (`feat(agent): …`), each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Never `--no-verify`.
- Then the refactor step (required), with its checklist and evidence: duplicates removed, helpers reused, names, constants, function length (≤50 lines), no suppressed error path.

## Report (final message)

1. `git log --oneline faf4aa8..HEAD`.
2. `git diff --stat faf4aa8..HEAD`, and confirmation that `git diff faf4aa8..HEAD -- tests/` is empty.
3. Each command above with its tail and exit code.
4. The red → green counts.
5. The refactor checklist with evidence.
6. Anything in the spec you found ambiguous and how you resolved it.

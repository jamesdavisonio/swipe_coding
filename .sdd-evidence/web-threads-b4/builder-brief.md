# Builder brief — web-threads B4 (Decision sheet)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/web-threads-b4`.
Red-checkpoint SHA: `9413961b3579902163120975173d2e7dd2c9b0c7` (commit `test(web-threads-b4): red checkpoint for the decision sheet`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. `docs/features/web-threads.md` — sections: "What the user sees", "B4 — Decision sheet" (criteria 16–20), "Cross-cutting" (28 — the tick half; 29 — the sheet's write-failure state; 30 on the sheet), "Out of scope", "Public contract and existing boundaries" — above all "B4 contract details fixed at test time" and its "Fidelity round 1 decisions (B4)" paragraph, which fix every write, guard, history text, label, prop and behaviour the tests use; the B2 and B3 blocks it builds on — "Files & modules affected", "Principles that apply", "Instrumentation"; and `docs/decisions/0003-stage-model.md` (log cap and archive).
2. The frozen tests (read-only): `tests/web-threads-b4-16.test.tsx` … `-20`, `-28`, `-30`; `tests/emulator/web-threads-b4-11.test.ts`, `-14`, `-16` … `-19`, `-28`; the fixtures `tests/fixtures/web-threads-b4.tsx`, `tests/fixtures/web-threads-b4-emulator.ts` and the B2/B3 fixtures they import. The B1–B3 tests must stay green too.
3. `prototype/index.html` — the agreed look and copy for the sheet (`sheetHtml` / the `view.sheet` branch: spec, question, pr, after_deploy; `.sheet`, `.doc`, `.opts`, `.opt`, `.lst`, `.chk`, `.strike` CSS).
4. The code B4 changes and reuses: `packages/web/src/data.ts`, `packages/web/src/lib/{messages,use-thread-actions,threads,log}.ts`, `packages/web/src/components/{DecisionSheet,QuickReplies,ThreadView}.tsx`, `packages/web/src/components/ui/sheet.tsx`, `packages/web/src/pages/Threads.tsx`, `packages/shared/src/index.ts` (`appendLog`, `LOG_CAP`, `TaskSpec`, `LogEntry`), `firestore.rules`.
5. `docs/design-system.md`, `packages/web/src/styles/tokens.css`, `packages/web/src/components/ui/*`, `packages/web/src/lib/{cn,icons,a11y}.ts`, `docs/security/A11Y_CHECKLIST.md`, `logging/taxonomy.json`, `docs/logging.md`, `docs/error-schema.md`.
6. Edit targets: `packages/web/src/**` — `data.ts` (`approveSpec`, `requestChange`, `answerQuestion`, `markMerged`, `tickStep`, the transaction helper's history/archive handling), `components/DecisionSheet.tsx` (plus small per-need sheet parts you split out), the sheet's openers (`Threads.tsx`, `ThreadView.tsx`) only as far as focus return requires, `lib/*` helpers, `lib/icons.ts`, tokens only if a needed value is missing. `firestore.rules` only if a write the contract requires is refused (say so and why).

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

B4 only: the decision sheet for the four needs, the decision writes with their history entries and archive overflow, `tickStep` and its optimistic checkbox, focus behaviour, and the instrumentation the contract lists. Specifically:

- History goes through `appendLog` inside the transaction; overflow past `LOG_CAP` is written to `tasks/{id}/log_archive` in the same transaction (one document per moved entry, its `at`, `who`, `text` as top-level fields). Keep one transaction helper; do not copy it per write.
- `tickStep` is a batch (offline-capable), built from the task as the screen has it, appending history with `arrayUnion`; the completing tick sets stage `done`, `doneAt`, need `null`, `working: false`, the `Done` entry (`who: 'system'`) and James's `After-deploy steps done.` message in the same batch.
- Guarded writes (wrong need, wrong stage, stale option key, empty text, bad index) write nothing and resolve without throwing.
- The sheet: controlled checkboxes from `afterDone` with an optimistic override only for a step whose tick is pending; buttons disabled while their write is pending; the inline alert and kept text on failure; it closes itself (via `onClose`) when the task no longer has the need it opened for; focus returns to the control that opened it.
- Reuse `track` for `user_action` and failures, `jamesComment`/`replyKind`, `activeNeed`, `webUrl`-style URL guarding and the `@kanban/shared` helpers rather than re-deriving them. `milestone_reached` via `log.event` only after the completing tick resolves.
- UI rules: tokens only (no hardcoded colours/sizes/durations), icons only via `lib/icons.ts`, 44 px rows and targets, visible focus ring, accessible names, light and dark both work.
- Anything for B5–B6 (Projects, New task, History list, Reopen) is out of scope.

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`; never point `KANBAN_SA` at a key file. The emulator suite (`npm run test:rules`) is the only Firestore you use.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: the 205 existing tests plus every B4 component test, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # rules + B4 emulator suites, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

Java 21 is at `C:\Users\Intel\Documents\tools\jdk-21`; shells in this session need that PATH prefix. The rules suite prints many `PERMISSION_DENIED` lines; that is noise from its refusal assertions.

## Working method

- Start by running `npx vitest run tests/web-threads-b4` and the emulator suite to see the red yourself (77 component failures; 35 emulator failures); implement the minimal code that turns them green; run after every meaningful change and report the counts going from red to green. Keep the B1–B3 tests green throughout.
- Commit as you go in logical conventional commits using the repo's scopes (`feat(web): …`, `chore(web): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- After green, do the refactor step and report it as a checklist with evidence: duplicates removed (list), helpers reused (list), any function over 50 lines or nesting over 4 split, constants named, no suppressed error paths, line counts of `data.ts`, `DecisionSheet.tsx` and any new file over 100 lines; then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline 9413961..HEAD`.
2. `git diff 9413961..HEAD --stat` and confirmation that `git diff 9413961..HEAD -- tests/` is empty.
3. Verbatim command + tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. What each write stores, how the archive overflow works, and whether `firestore.rules` changed.
7. Anything where spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

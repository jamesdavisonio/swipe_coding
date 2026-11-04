# Builder brief — web-threads B6 (History and Reopen)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/web-threads-b6`.
Red-checkpoint SHA: `1174a7d6aba438c51466968cda6cb77ab4c5dcc2` (commit `test(web-threads-b6): red checkpoint for History and Reopen`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. `docs/features/web-threads.md`, these sections:
   - "What the user sees"
   - "B6 — History and Reopen" (criteria 25–27)
   - "Cross-cutting" (29 and 30 on the History and Reopen sheets)
   - "Out of scope"
   - "Public contract and existing boundaries", above all "B6 contract details fixed at test time". That block fixes every label, write, guard, history text, time format and event the tests use. Also read the B2–B5 blocks it builds on.
   - "Files & modules affected", "Principles that apply", "Instrumentation"
   - `docs/decisions/0003-stage-model.md` (history cap and archive, reopen)
2. The frozen tests (read-only):
   - `tests/web-threads-b6-25.test.tsx`, `-26`, `-27`, `-29`, `-30`
   - `tests/emulator/web-threads-b6-25.test.ts` and `-26`
   - the fixtures `tests/fixtures/web-threads-b6.tsx` and `tests/fixtures/web-threads-b6-emulator.ts`, plus the B2–B5 fixtures they import

   The B1–B5 tests must stay green too.

   Note that `-25`'s last describe re-imports the app under a stubbed time zone and locale. Your history time format must be day first with an English month, in the device time zone, whatever the locale. Do not use the device's default locale for it.

3. `prototype/index.html`: the agreed look and copy for the History sheet (`.hist`, `.e`, `.when`, the `view.sheet === 'log:'` branch) and the Reopen sheet (the `reopen:` branch).
4. The code B6 changes and reuses:
   - `packages/web/src/data.ts` (the transaction helper with `appendLog` and archive overflow from B4)
   - `packages/web/src/components/{HistorySheet,ThreadView,ThreadFooter,MessageList,Messages,DoneList,DecisionSheet,SaveError}.tsx`
   - `packages/web/src/components/ui/sheet.tsx`
   - `packages/web/src/lib/{messages,threads,use-thread-actions,use-decision}.ts`
   - `packages/web/src/pages/{Thread,Project}.tsx`
   - `packages/shared/src/index.ts` (`appendLog`, `LOG_CAP`, `taskStages`, `STAGE_LABEL`, `isDone`)
   - `firestore.rules` (`log_archive` is owner read/write)
5. `docs/design-system.md`, `packages/web/src/styles/tokens.css`, `packages/web/src/components/ui/*`, `packages/web/src/lib/{cn,icons,a11y}.ts`, `docs/security/A11Y_CHECKLIST.md`, `logging/taxonomy.json`, `docs/logging.md`, `docs/error-schema.md`.
6. Edit targets: `packages/web/src/**`:
   - `components/HistorySheet.tsx`
   - new `components/ReopenSheet.tsx`
   - `data.ts`: `reopenTask` and `useLogArchive`
   - the Reopen openers: the thread footer, the Done tab cards (with a History button) and the History sheet's `Reopen task`
   - the derived `Reopened by you` line in the message list
   - a locale-independent time formatter in `lib/`
   - `lib/icons.ts`, and tokens only if a needed value is missing

   Change `firestore.rules` only if a write the contract requires is refused. If you do, say so and why.

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read `docs/features/board-briefs.md` (a later feature). Do not read files in any temp or scratchpad folder other than this brief.

## Scope

B6 only. Specifically:

- **`reopenTask(task, note)`** is a transaction guarded on stage `done`.
  - Anything else, or a blank note, writes nothing and resolves.
  - The note is trimmed and capped at 4000.
  - It sets `doneAt: null`, `reopenedAt` now, and the stage before `done` in the task's own chain. `needs` is `{ kind: 'after_deploy' }` when that stage is `after_deploy`, else `null`.
  - It adds history `Reopened: <note>` (`who: 'james'`) through the shared transaction helper with archive overflow, and writes James's comment of kind `reopen` with the body `Reopened: <note>`.
  - Everything else on the task stays as it is.
- **`useLogArchive(taskId, enabled)`** is a live read of `tasks/{id}/log_archive` ordered by `at`. While disabled it reads nothing.
- **History sheet:**
  - entries from `task.log`, oldest first;
  - who shown as `You` / `Session` / `Board`;
  - time as `Today HH:MM`, `Yesterday HH:MM`, else `<day> <Mon> HH:MM`, in a locale-independent format;
  - `Nothing recorded yet.` when the log is empty;
  - `Show earlier history` only when the log is at `LOG_CAP`, loading the archive above the rest, with loading, error and Retry states;
  - `Reopen task` only on a done task;
  - opening it is not logged.
- **Reopen sheet:** the copy, the disabled states, the alert and the navigation exactly as the contract says. James stays on the thread, with no navigation and no duplicate history entry, when he is already on it. Focus returns to the opener.
- **`Reopened by you`** is not stored. It is derived from the James `Reopened:` history entries and placed in time order with the messages.
- **Logging:** reuse `track` and `reportFailure` for `user_action` `reopen`. Log `milestone_reached` `task_reopened` after the write resolves, with the same `request_id`. A failure logs `api_call_failed`.
- **UI rules:**
  - tokens only, with no hardcoded colours, sizes or durations;
  - icons only via `lib/icons.ts`;
  - 44 px targets, a visible focus ring, accessible names;
  - light and dark both work.
- **Out of scope:** anything for B7/B8 (briefs, voice, agent changes).

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`; never point `KANBAN_SA` at a key file. The emulator suite (`npm run test:rules`) is the only Firestore you use.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: the 386 earlier tests plus every B6 component test, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # rules + all emulator suites, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

## Working method

- Start by running `npx vitest run tests/web-threads-b6` and the emulator suite to see the red yourself: 50 component failures and 15 emulator failures.
- Implement the minimal code that turns them green. Run after every meaningful change, and report the counts going from red to green. Keep the B1–B5 tests green throughout.
- Commit as you go in logical conventional commits using the repo's scopes (`feat(web): …`, `chore(web): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- After green, do the refactor step and report it as a checklist with evidence:
  - duplicates removed (list);
  - helpers reused (list);
  - any function over 50 lines or nesting over 4 split;
  - constants named;
  - no suppressed error paths;
  - line counts of `data.ts` and any new file over 100 lines.

  Then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline 1174a7d..HEAD`.
2. `git diff 1174a7d..HEAD --stat`, and confirmation that `git diff 1174a7d..HEAD -- tests/` is empty.
3. Verbatim command and tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. What `reopenTask` stores, how the time format stays locale-independent, and whether `firestore.rules` changed.
7. Anything where spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

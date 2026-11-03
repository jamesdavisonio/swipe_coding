# Builder brief — web-threads B3 (Thread view)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/web-threads-b3`.
Red-checkpoint SHA: `0bcf6d2ce87092e8daab5c3f40f486a93ae790be` (commit `test(web-threads-b3): red checkpoint for the thread view`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. `docs/features/web-threads.md` — sections: "What the user sees", "B3 — Thread view" (criteria 13–15), B1 criterion 2 (its "opened by id" clause is B3's), "Cross-cutting" (28 — the reply half only; ticking a step is B4's — and 29, 30 on the thread view), "Out of scope", "Public contract and existing boundaries" — above all "B3 contract details fixed at test time" and its "Fidelity round 1 decisions (B3)" paragraph, which fix every module, name, label, prop and behaviour the tests use; the B2 block it builds on — "Files & modules affected", "Principles that apply", "Instrumentation".
2. The frozen tests (read-only): `tests/web-threads-b3-13.test.tsx`, `-14`, `-15`, `-2`, `-28`, `-29`, `-30`, and the fixtures `tests/fixtures/web-threads-b3.tsx` and `tests/fixtures/web-threads-b2.tsx` (which it imports). The B2 tests must stay green too.
3. `prototype/index.html` — the agreed look and copy for the thread (`threadScreen`, `stepsHtml`, `ticksHtml`, the `.conv`/`.msg`/`.bub`/`.sys`/`.typing`/`.composer`/`.steps` CSS).
4. The B2 code the thread reuses: `packages/web/src/lib/{threads,use-thread-actions,log,request-id,use-now}.ts`, `packages/web/src/components/{QuickReplies,DecisionSheet,ThreadRow}.tsx`, `packages/web/src/pages/Threads.tsx`, `packages/web/src/data.ts`, `packages/web/src/firebase.ts`.
5. `docs/design-system.md`, `packages/web/src/styles/tokens.css`, `packages/web/src/components/ui/*`, `packages/web/src/lib/{cn,icons,a11y,theme}.ts`, `docs/security/A11Y_CHECKLIST.md`, `logging/taxonomy.json`, `docs/logging.md`, `docs/error-schema.md`.
6. Edit targets: `packages/web/src/**` — new `pages/Thread.tsx`, `components/StageStepper.tsx`, `components/HistorySheet.tsx` (plus small message/ticks/composer components you split out), `data.ts`, `firebase.ts`, `App.tsx`, `lib/use-thread-actions.ts` (Threads passes `state.from`), `lib/icons.ts`, tokens only if a needed value is missing; retire `pages/Task.tsx` and anything only it used.

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

B3 only: the thread view at `/t/:taskId`, its stepper, ticks, composer and states, the `sendReply`/`newCommentId` writes, offline persistence, the Threads → thread `state.from`, and a minimal `HistorySheet`. Specifically:

- `HistorySheet` is B6's to fill. In B3 it is a real, accessible sheet on `components/ui/sheet` (dialog semantics, a heading, a Close that calls `onClose`), with no history list yet. The tests mock it, so keep it small.
- `sendReply(task, { id, body })` writes James's comment under the given id (a retry cannot duplicate it), body trimmed and capped at 4000 characters: kind `answer` and the question need cleared in the same write when the need is a question; otherwise kind `comment` and the need left untouched. Use a batch or the existing transaction pattern so the comment and the need change land together. It replaces `addComment`; remove `addComment` if nothing else uses it. No history (`log[]`) entries — those are B4's.
- Offline: initialise Firestore with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`, keeping the emulator connection logic. jsdom cannot exercise it; say in your report what you changed.
- The optimistic message is keyed by the id from `newCommentId()` and dropped once the snapshot contains that id; never match by text. Every send takes a fresh id.
- Reuse B2's `track` helper for `user_action` `reply` and the failed-write `api_call_failed`; reuse `QuickReplies`, `quickReplies`, `stageText`, `relativeTime`, `activeNeed`, `daysUntilHidden` and the `@kanban/shared` helpers (`deliveryState`, `taskStages`, `STAGE_LABEL`, `isDone`, `isAgentOnline`) rather than re-deriving them.
- UI rules: tokens only (no hardcoded colours/sizes/durations), icons only via `lib/icons.ts`, 44 px targets, visible focus ring, accessible names, light and dark both work, typing dots respect `prefers-reduced-motion`.
- Anything for B4–B6 (decision actions and their history entries, ticking after-deploy steps, Projects/New task, the History list, Reopen) is out of scope.

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`; never point `KANBAN_SA` at a key file.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: the 120 existing tests plus every B3 test, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # 34 tests, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

Java 21 is at `C:\Users\Intel\Documents\tools\jdk-21`; shells in this session need that PATH prefix. The rules suite prints many `PERMISSION_DENIED` lines; that is noise from its refusal assertions.

## Working method

- Start by running `npx vitest run tests/web-threads-b3` to see the red yourself (every file currently fails at import resolution of `pages/Thread.tsx`); implement the minimal code that turns them green; run after every meaningful change and report the counts going from red to green. Keep the B2 tests green throughout.
- Commit as you go in logical conventional commits using the repo's scopes (`feat(web): …`, `chore(web): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- After green, do the refactor step and report it as a checklist with evidence: duplicates removed (list), helpers reused (list), any function over 50 lines or nesting over 4 split, constants named, no suppressed error paths, line counts of `Thread.tsx`, `data.ts` and any new component over 100 lines; then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline 0bcf6d2..HEAD`.
2. `git diff 0bcf6d2..HEAD --stat` and confirmation that `git diff 0bcf6d2..HEAD -- tests/` is empty.
3. Verbatim command + tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. What changed in `firebase.ts` for offline persistence, and what `sendReply` writes in each case.
7. Anything where spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

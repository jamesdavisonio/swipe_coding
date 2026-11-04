# Builder brief — web-threads B5 (Projects and New task)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/web-threads-b5`.
Red-checkpoint SHA: `ae097d1692afd32120e97c014671155b293b9b0f` (commit `test(web-threads-b5): red checkpoint for Projects and New task`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. `docs/features/web-threads.md`. Read these sections:
   - "What the user sees"
   - "B5 — Projects and New task" (criteria 21–24)
   - "Cross-cutting" (29 and 30 on the Projects, project and New task screens)
   - "Out of scope"
   - "Public contract and existing boundaries", above all "B5 contract details fixed at test time" and its "Fidelity round 1 decisions (B5)" paragraph. Together they fix every screen, label, route, write, cap, history text and event the tests use.
   - The B2–B4 contract blocks that B5 builds on.
   - "Files & modules affected", "Principles that apply" and "Instrumentation".
2. The frozen tests (read-only):
   - `tests/web-threads-b5-21.test.tsx`, `-22`, `-23`, `-24`, `-29`, `-30`
   - `tests/emulator/web-threads-b5-22.test.ts`, `-23`, `-24`
   - the fixtures `tests/fixtures/web-threads-b5.tsx` and `tests/fixtures/web-threads-b5-emulator.ts`, plus the B2–B4 fixtures they import

   The B1–B4 tests must stay green too.

3. `prototype/index.html`: the agreed look and copy for `projectsScreen`, `projectScreen` and `newScreen` (cards, `.seg` tabs, `.lst` rows, the stage preview).
4. The code B5 changes and reuses:
   - `packages/web/src/data.ts` (`createTask`, `addTodo`, `toggleTodo`, the project hooks)
   - `packages/web/src/App.tsx`
   - `packages/web/src/pages/{Home,Board,Threads,Thread}.tsx`
   - `packages/web/src/components/{BottomNav,StageStepper,MessageList,ThreadRow}.tsx`
   - `packages/web/src/lib/{threads,use-thread-actions,messages,log}.ts`
   - `packages/web/src/ui.tsx`, `packages/web/src/lib/legacy-status.ts`
   - `packages/shared/src/index.ts` (`initialTaskFields`, `isTaskVisible`, `isAgentOnline`, `stagesFor`, `STAGE_LABEL`, `DONE_VISIBLE_MS`, `AGENT_STALE_MS`)
5. Design and conventions:
   - `docs/design-system.md`, `packages/web/src/styles/tokens.css`, `packages/web/src/components/ui/*`
   - `packages/web/src/lib/{cn,icons,a11y}.ts`, `docs/security/A11Y_CHECKLIST.md`
   - `logging/taxonomy.json`, `docs/logging.md`, `docs/error-schema.md`
6. Edit targets: `packages/web/src/**`:
   - New `pages/Projects.tsx`, `pages/Project.tsx` and `pages/NewTask.tsx`, plus small components you split out.
   - `data.ts` (the `createTask` input and history entry, the caps, the blank-title rejection, the `addTodo` cap and blank refusal).
   - `App.tsx` routes.
   - The thread view's queue line (in place of `No messages yet.` for a queued task James created).
   - Retire `pages/Home.tsx`, `pages/Board.tsx`, and the parts of `ui.tsx` / `lib/legacy-status.ts` only they use.
   - `lib/*` helpers, `lib/icons.ts`, and tokens only if a needed value is missing.

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read `docs/features/board-briefs.md` (a later feature, not yet confirmed). Do not read files in any temp or scratchpad folder other than this brief.

## Scope

B5 only: the three screens, the routes, the `createTask` and `addTodo` changes, the queue line, and the instrumentation the contract lists. Specifically:

- **Windows come from the shared constants.** Online is `lastSeen` within `AGENT_STALE_MS` (use `isAgentOnline`). "This week" and the Done tab are `isTaskVisible` / `DONE_VISIBLE_MS`. Never hard-code a duration.
- **Done ordering.** Sort each Done bucket by `doneAt`, newest first. Live is needing James first, then most recently updated. For James is open before done, newest first.
- **`createTask`** writes the task from `initialTaskFields` (queued), applies the caps, and adds the one `who: 'james'` history entry with the contract's text. A blank title rejects and writes nothing.
- **Logging.** `queue_task` and the `task_queued` milestone go out once the save resolves, under one `request_id`. The untick logs `todo_undone`. Failed writes log `api_call_failed` through the existing `track`/`reportFailure` helpers.
- **The queue line** is not stored. It only replaces `No messages yet.` while a task James created is queued and its thread is empty.
- **Reuse, don't re-derive.** Use `needsCount`, `stageText`, `relativeTime`, `webUrl`, `StageStepper`, `BottomNav`, `track` and the `@kanban/shared` helpers.
- **UI rules.** Tokens only (no hardcoded colours, sizes or durations), icons only via `lib/icons.ts`, 44 px targets, a visible focus ring, accessible names, `aria-pressed` on tabs and type buttons. Light and dark must both work.
- **Out of scope.** Anything for B6 (History list, Reopen) or for later features.

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`; never point `KANBAN_SA` at a key file. The emulator suite (`npm run test:rules`) is the only Firestore you use.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: the 282 existing tests plus every B5 component test, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # rules + all emulator suites, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

## Working method

- Start by running `npx vitest run tests/web-threads-b5` and the emulator suite to see the red yourself: 6 component files fail at import resolution, and 11 emulator tests fail.
- Implement the minimal code that turns them green. Run after every meaningful change, and report the counts going from red to green. Keep the B1–B4 tests green throughout.
- Commit as you go, in logical conventional commits using the repo's scopes (`feat(web): …`, `chore(web): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- After green, do the refactor step and report it as a checklist with evidence:
  - duplicates removed (list)
  - helpers reused (list)
  - any function over 50 lines or nesting over 4, split
  - constants named
  - no suppressed error paths
  - line counts of `data.ts`, each new page, and any new file over 100 lines

  Then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline ae097d1..HEAD`.
2. `git diff ae097d1..HEAD --stat`, and confirmation that `git diff ae097d1..HEAD -- tests/` is empty.
3. The verbatim command and tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. What `createTask` and `addTodo` now store or refuse, and which Phase 1 files you retired.
7. Anything where the spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

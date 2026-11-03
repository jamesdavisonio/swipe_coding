# Builder brief — web-threads B2 (Threads home)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/web-threads-b2`.
Red-checkpoint SHA: `0e803d07def1fa850a443c9cee632d3d30619638` (commit `test(web-threads-b2): red checkpoint for the Threads home`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. `docs/features/web-threads.md` — sections: "What the user sees", "B2 — Threads home" (criteria 6–12), "Cross-cutting" (29 and 30 apply to the Threads screen and the bottom nav; 28 is not B2's), "Out of scope", "Public contract and existing boundaries" — above all "B2 contract details fixed at test time", which fixes every module, name, label, route and prop the tests use — "Files & modules affected", "Principles that apply", "Instrumentation".
2. The frozen tests (read-only): `tests/web-threads-b2-6.test.tsx` … `-12`, `-29`, `-30`, and `tests/fixtures/web-threads-b2.tsx`.
3. `prototype/index.html` — the agreed look and copy for Threads (`threadsScreen`, `quickHtml`, `navHtml`, `stageText`, `rel`, the `.row`/`.chip`/`.nav` CSS).
4. `docs/design-system.md`, `packages/web/src/styles/tokens.css`, `packages/web/src/components/ui/*`, `packages/web/src/lib/{cn,icons,a11y,theme}.ts`, `docs/security/A11Y_CHECKLIST.md`.
5. `logging/taxonomy.json`, `logging/logger.browser.js`, `app.manifest.yaml`, `docs/logging.md`, `docs/error-schema.md`.
6. Edit targets: `packages/web/src/**` — new `pages/Threads.tsx`, `lib/threads.ts`, `lib/log.ts`, `components/BottomNav.tsx`, `components/DecisionSheet.tsx` (plus any small row/chip/quick-reply components you split out), `data.ts`, `App.tsx`, `lib/icons.ts`, tokens only if a needed value is missing. `packages/shared` only if a pure helper genuinely belongs there.

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

B2 only: the Threads home (`/`), its pure helpers, the bottom nav, the data-layer hooks and the three small actions the contract lists, the logger wiring, and a minimal `DecisionSheet`. Specifically:

- `DecisionSheet` is B4's to fill. In B2 it is a real, accessible sheet on `components/ui/sheet` (dialog semantics, a heading with the task title, the need's question or a one-line summary, and a Close button that calls `onClose`), with no decision actions yet. The tests mock it, so keep it small.
- `answerQuestion`, `markMerged`, `markRead` write exactly what the contract's "B2's minimal writes" line says, using the existing `transitionTask` / `jamesComment` patterns in `data.ts` (merged is guarded on stage `pr`; a double tap is a no-op). No history (`log[]`) entries — those are B4's.
- Read hooks: `Live<T>` gains `retry()`; `useAllTasks()` and `useAgents()` are new. A rejected read logs `api_call_failed` (ERROR) through the shared logger with `{ feature: 'web-threads', target: 'firestore', action: 'read', status: <error code> }`, per the contract's round-1 decisions.
- `lib/log.ts`: the one place that calls `initLogger({ manifest, taxonomy, piiKeys, source: 'web_client' })`. Manifest values come from `app.manifest.yaml`, never typed freehand into feature code; choose the smallest honest way to get them into the bundle and say which in your report. `log_endpoint` is null today, so nothing is sent; that is expected.
- Routes: `/` → Threads; the Phase 1 project list (`pages/Home.tsx`) moves to `/projects` until B5; `/p/:projectId` and `/t/:taskId` stay as they are; `/new` is B5's (leave the catch-all redirect). Remove nothing else of Phase 1 beyond what this forces.
- UI rules: tokens only (no hardcoded colours/sizes/durations), icons only via `lib/icons.ts`, 44 px targets, visible focus ring, accessible names, `aria-pressed` on chips, `aria-current` on the nav, light and dark both work. Use `isTaskVisible`, `isDone`, `STAGES` and the other `@kanban/shared` helpers rather than re-deriving them. Live dot: a project is live when one of its agents is online (`isAgentOnline`).
- Anything for B3–B6 (thread view rebuild, decision actions, Projects/New task screens, history, reopen, offline queueing) is out of scope.

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`; never point `KANBAN_SA` at a key file.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: the 39 existing tests plus every B2 test, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # 34 tests, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

Java 21 is at `C:\Users\Intel\Documents\tools\jdk-21`; shells in this session need that PATH prefix. The rules suite prints many `PERMISSION_DENIED` lines; that is noise from its refusal assertions.

## Working method

- Start by running `npx vitest run tests/web-threads-b2` to see the red yourself (every file currently fails at import resolution, so expect individual failures to appear as modules land); implement the minimal code that turns them green; run after every meaningful change and report the counts going from red to green.
- Commit as you go in logical conventional commits using the repo's scopes (`feat(web): …`, `chore(web): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- After green, do the refactor step and report it as a checklist with evidence: duplicates removed (list), helpers reused (list), any function over 50 lines or nesting over 4 split, constants named, no suppressed error paths, line counts of `Threads.tsx`, `data.ts` and `lib/threads.ts`; then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline 0e803d0..HEAD`.
2. `git diff 0e803d0..HEAD --stat` and confirmation that `git diff 0e803d0..HEAD -- tests/` is empty.
3. Verbatim command + tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. How the manifest values reach `lib/log.ts`.
7. Anything where spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

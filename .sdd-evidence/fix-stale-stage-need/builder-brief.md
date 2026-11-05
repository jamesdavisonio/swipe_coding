# Builder brief — fix: clear a skipped stage's need

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `fix/stale-stage-need`.
Red-checkpoint SHA: `b3ac3cb72e7bc1241dfe87a1b1b3d38d6458ba3d` (commit `test(stale-stage-need): red checkpoint for clearing a skipped stage's need`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. The fix spec: the commit message of the red checkpoint (`git show -s b3ac3cb`).
2. The frozen repro test (read-only): `tests/emulator/fix-stale-stage-need.test.ts`, and the fixture it imports, `tests/fixtures/board-briefs-b7-emulator.ts`.
3. The code: `packages/agent/src/board.ts`, in particular `NEED_OF_STAGE`, `advancePast`, `subtaskPatch`, `setSubtask` and `donePatch`; plus `taskStages` in `packages/shared/src/index.ts`. Background: `docs/decisions/0003-stage-model.md` (stages and needs).

Do not read or create anything under `.sdd-evidence/`. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

One change in `advancePast` in `packages/agent/src/board.ts`. When the task moves past `stage`, clear `needs` if its kind is the need of any stage the task passes: from the task's current stage through `stage`, inclusive, in the task's own chain. Keep everything else as it is:

- A `question` need is never cleared by this.
- A stage the task has already passed changes nothing.
- Moving past the last stage is still `donePatch`.

Nothing else changes. Nothing you do may touch the live Firestore project: never set `KANBAN_TEST_LIVE`, and never point `KANBAN_SA` at a key file.

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

If `test:rules` ends with a vitest worker crash ("Channel closed") and no failing test, that is a known flaky harness issue: run it again and report both runs.

## Working method

- Run the repro first to see it red: 3 failed, 3 passed.
- Make the minimal change, then run the commands above.
- Commit once as `fix(agent): clear the need of every stage a task jumps past`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Refactor checklist:
  - duplicates
  - names
  - constants
  - function length
  - no suppressed error path

## Report (final message)

1. `git log --oneline b3ac3cb..HEAD`.
2. `git diff b3ac3cb..HEAD`, and confirmation that `git diff b3ac3cb..HEAD -- tests/` is empty.
3. Each command with its tail and exit code.
4. The red → green counts.
5. The refactor checklist.

# Builder brief — board-briefs B7 (briefs, PR-ready, finished-work summaries)

Role: `build`, fresh context. Repo: `C:\Users\Intel\Documents\code\kanban`, branch `feat/board-briefs-b7`.
Red-checkpoint SHA: `23770ca7b061bc9295822bc2e22ebbfde6abe6c1` (commit `test(board-briefs-b7): red checkpoint for briefs, PR-ready and finished-work summaries`). The test files in that commit are frozen; a PreToolUse hook rejects edits to anything under `tests/`.

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

1. `docs/features/board-briefs.md`, all of it. Pay most attention to these parts:
   - "B7 — Briefs, pull requests and finished-work summaries" (criteria 31–37)
   - criterion 41 as it applies to B7's controls
   - "B7 contract details fixed at test time", including "Fidelity round 1 decisions (B7)"
   - "Principles that apply" and "Instrumentation"

   Also read `docs/features/web-threads.md` for the B2–B4 contract blocks B7 builds on.

2. The skills' brief format, the input the board parses: `C:\Users\Intel\.claude\skills\implement-feature\references\decision-brief.md`. It is the only file outside the repo you may read besides this brief.
3. The frozen tests (read-only):
   - `tests/board-briefs-b7-31.test.tsx` … `-36`, `-37.test.ts` and `-41`
   - `tests/emulator/board-briefs-b7-34.test.ts` and `-35`
   - the fixtures `tests/fixtures/board-briefs-b7.tsx` and `tests/fixtures/board-briefs-b7-emulator.ts`, plus the earlier fixtures they import

   Everything earlier must stay green.

4. The code B7 changes and reuses:
   - `packages/agent/src/board.ts`: `updateTask`, `prPatch`, `donePatch`, `writeAgentComment`
   - `packages/agent/src/index.ts`: the `INSTRUCTIONS` constant
   - `packages/agent/test/protocol.ts`, to see how the agent is spawned offline
   - `packages/web/src/components/{Messages,MessageList,QuickReplies,ThreadRow,DecisionSheet,SpecDecision,QuestionDecision,PrDecision,SaveError}.tsx`
   - `packages/web/src/lib/{messages,threads,use-thread-actions,use-decision}.ts`
   - `packages/web/src/data.ts` (`answerQuestion`)
5. Design rules: `docs/design-system.md`, `packages/web/src/styles/tokens.css`, `packages/web/src/components/ui/*`, `packages/web/src/lib/{cn,icons,a11y}.ts`, `logging/taxonomy.json`, `docs/logging.md`.
6. Edit targets:
   - New `packages/web/src/lib/brief.ts` (`parseBrief`, `suggestedNext`).
   - A brief card component, and the suggested-next list with Copy buttons.
   - The thread messages, the spec, question and PR sheets, and the quick replies and row preview.
   - `packages/agent/src/instructions.ts`, a new file exporting `SESSION_INSTRUCTIONS`. `index.ts` must send it.
   - `packages/agent/src/board.ts`, for the PR-ready need by stage and the Done message plus unread, once.
   - `lib/icons.ts`, and tokens only if a needed value is missing.

Do not read or create anything under `.sdd-evidence/`; it is outside your scope. Do not read files in any temp or scratchpad folder other than this brief.

## Scope

B7 only. Specifically:

- **`parseBrief`** follows the contract exactly. It requires all six sub-headings in order. It returns the gate label, the six parts, the text before and after, and the reply phrase. Malformed text returns `null` and renders exactly as today.
- **Brief cards** render wherever the contract says:
  - thread messages
  - the spec sheet (brief first, then a `Full spec` toggle with `aria-expanded`; collapsed content is not rendered or is hidden with `hidden`)
  - question rows and the question sheet (`<label> — <task title>`, a one-tap `<replyPhrase>` button)
  - the PR sheet (the most recent summary brief, above the B4 content)
- **The one-tap answer** calls `answerQuestion(task, { label: phrase })` once, through `track` as `gate_reply`. In the sheet, a failure shows the B4 alert and keeps the sheet open. On a row, a failure is only logged.
- **Suggested next** shows a list headed `You could start next`. Each item has a Copy button named `Copy: <item>`. Copy calls `navigator.clipboard.writeText` through `track` as `copy_suggestion`, and shows `Copied` for two seconds before returning to `Copy`. It starts nothing.
- **Agent `prPatch` and `updateTask`:**
  - **`pr_url` at the build or fix stage, or at pr:** set stage `pr` and `needs: { kind: 'pr' }`.
  - **`pr_url` at an earlier stage:** record `pr` only. Today's code moves the stage, and that must stop.
  - **`pr_url` at merged or later:** record `pr` only and leave the need as it is.
  - **`status: 'done'` on a task that is not done:** write a session comment of kind `done` (the body is the summary, or `Done.` when there is none) and set `unread: true`, in the same batch as the done patch.
  - **`status: 'done'` on a task already done:** write no second Done message.
- **Instructions** move to `packages/agent/src/instructions.ts` and keep everything the old text said. Add the rules the contract lists:
  - Post the spec brief as the `note` on awaiting_approval.
  - Post fix, round and summary briefs as `kanban_ask` questions ending with the `Reply "<phrase>"` line.
  - Report the PR with `pr_url`.
  - Finish with `status: 'done'` and a summary ending with `### Suggested next`, one suggestion per line, when there are follow-ups.
- **UI rules:**
  - Tokens only: no hardcoded colours, sizes or durations. The two seconds is a named constant.
  - Icons only via `lib/icons.ts`.
  - 44 px targets, a visible focus ring, accessible names. Light and dark both work.
- **Out of scope:** anything for B8, voice.

Nothing you do may touch the live Firestore project. Never set `KANBAN_TEST_LIVE`, and never point `KANBAN_SA` at a key file. The emulator suite (`npm run test:rules`) is the only Firestore you use.

## Whole-repo green

Done means all of these pass from the repo root in Git Bash:

```
npm run lint
npm run typecheck            # agent + web + root tsconfig (tests/)
npm test                     # vitest: every earlier test plus every B7 test, 0 failed
npm run build:web
node scripts/check-contrast.mjs
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules          # rules + all emulator suites, 0 failed
PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npx firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"   # ends "all good"
node scripts/check-firestore-rules.mjs
npx prettier --check .
```

## Working method

- Start by running `npx vitest run tests/board-briefs-b7` and the emulator suite, to see the red yourself: 62 component failures, the -37 file failing to load, and 9 emulator failures.
- Implement the minimal code that turns them green. Run after every meaningful change and report the counts going from red to green. Keep everything earlier green throughout. That includes the agent protocol test, which checks the agent's old behaviour.
- Commit as you go in logical conventional commits, using the repo's scopes (`feat(web): …`, `feat(agent): …`). The pre-commit hook runs lint-staged. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not amend the red-checkpoint commit or anything before it.
- After green, do the refactor step and report it as a checklist with evidence:
  - duplicates removed (list)
  - helpers reused (list)
  - any function over 50 lines or nesting over 4 split
  - constants named
  - no suppressed error paths
  - line counts of `board.ts`, `brief.ts`, and any new file over 100 lines

  Then re-run everything and paste the outputs.

## Report (final message)

1. `git log --oneline 23770ca..HEAD`.
2. `git diff 23770ca..HEAD --stat`, and confirmation that `git diff 23770ca..HEAD -- tests/` is empty.
3. Verbatim command + tail (with exit codes) for each command in "Whole-repo green".
4. The red → green progression you observed (counts).
5. The refactor checklist.
6. What the agent now does on `pr_url` and on `status: 'done'`, and what the instructions say.
7. Anything where the spec and tests seemed to conflict, or a test seemed wrong (you must not have edited it).

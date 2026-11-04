# board-briefs B7 — fresh-context review (claude-opus, fresh context)

Reviewed `23770ca..2d2fcbd`; the approved test amendment `c0fc518` and the docs commit `0152229`
landed during the review and were checked too. The reviewer's verdict as returned:

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 483 / tests 0 in the reviewed range 23770ca..2d2fcbd (about 30 of the app lines are the session instructions moved from index.ts into instructions.ts). Test amendment c0fc518: 3 lines in one test file. Docs commit 0152229: 15 lines in DESIGN.md and docs/design-system.md.
- Duplicated helpers: none. One brief parser (`lib/brief.ts`); `questionBrief`, `rowPreview` and `questionTitle` in threads.ts build on it. Both one-tap gate answers (`use-thread-actions.ts:86`, `QuestionDecision.tsx:48`) go through the existing `track` and `useDecision`.
- Harness files added: none. New files are app code: `instructions.ts`, `BriefBlock.tsx`, `BriefCard.tsx`, `MessageBody.tsx`, `SuggestedNext.tsx`, `lib/brief.ts`, `lib/use-copy.ts`, `lib/use-latest-brief.ts`.

Test amendment: c0fc518 changes only `tests/board-briefs-b7-36.test.tsx`, adding one `vi.useRealTimers()` line and a comment before the test's own `vi.useFakeTimers(...)`. No assertion removed or widened, nothing skipped; it is the harness-only fix described as pending with the owner. With it, the implementation passes the test unchanged. (The reviewer asked for the owner's approval to be confirmed: James replied "fix confirmed" in the session on 2026-11-04 to the fix brief in `test-amendment.md`.)

Anti-gaming checklist (walked): no test change in 23770ca..2d2fcbd; no `.only`/`.skip`/xfail; no `@ts-ignore`, `@ts-expect-error`, `as any`, `as unknown as` or inline `eslint-disable`; no bare swallowing catch (failures go through `track`/`reportFailure` with the tap's `request_id`); no test literals in app code (the gate phrases appear only in the session instructions, as the spec requires); no widened assertions, sleeps or retries.

Commands run: `npx vitest run` at 2d2fcbd: 520 passed, 1 failed (the known B7-36 Copy test, `setTimeout` not faked); after c0fc518 `tests/board-briefs-b7-36` + `-41`: 11/11 passed, so "Copied" for 2,000 ms then "Copy" is correct (`use-copy.ts:23`, `COPIED_MS = 2_000`, set only after `writeText` resolves, earlier timer cleared); typecheck clean; lint clean; `test:rules` 16/16 files, 124/124 tests.

Criteria: 31 brief card in the thread (`parseBrief` brief.ts:113 → `MessageBody` → `BriefBlock`/`BriefCard`, Messages.tsx:31); 32 spec sheet leads with the brief (`SpecContent`/`SpecBrief`, `Full spec` with `aria-expanded`/`aria-controls`, falls back to the text around the brief when `task.spec` is null); 33 question that is a brief (`rowPreview`/`questionTitle` threads.ts:231/238, phrase quick reply before `Read more`, `gate_reply` through `track`, sheet phrase button through `useDecision`); 34 PR waits on James's merge (`prPatch` board.ts:547 with `PR_READY_FROM` build/fix/do/pr; `PrDecision` shows `useLatestBrief(task.id,'summary')`); 35 Done message (board.ts:280-283, only when not already done, one batch with the done patch and `unread: true`); 36 suggested next (`suggestedNext`/`withoutSuggestedNext`, `SuggestedNext` list and Copy buttons, `copy_suggestion` through `track`); 37 session instructions (`SESSION_INSTRUCTIONS`, used by index.ts:166, checked over `initialize`); 41 keyboard and names (the `Button` primitive everywhere; Tab/Enter/Space paths tested; no explicit focus-ring assertion).

Principles: io-validation (brief.ts:114, :165, threads.ts:227, :235; malformed text renders plain), idempotency (`!isDone(task)` guard board.ts:280; repeated `pr_url` at `pr` rewrites the same stage and need; `useDecision` busy ref), graceful-degradation (plain rendering when parsing fails; speech is B8), observability (`gate_reply`, `copy_suggestion`; `Full spec` not logged), traceability (one `newRequestId()` per tap, passed to `reportFailure`).

Minor follow-ups (not blocking):

1. `SuggestedNext.tsx:22`: after a tap the accessible name becomes `Copied: <item>`; the spec names the button `Copy: <item>`.
2. `data.ts:353` (existing B4 code): `answerQuestion` writes `Answered ${need.question}: ${label}` into history, which now holds raw brief markdown for brief questions; use `questionTitle` or the brief label.
3. `board.ts:278-279`: one `kanban_update_task` call with both `pr_url` and `status: 'in_progress'` lets `needs: null` override the PR need (unlikely combination).
4. `brief.ts:41`: `SUGGESTED_HEADING` is case-insensitive, looser than the spec's exact `### Suggested next` (harmless).
5. `brief.ts:93-97`: text between `## Decision brief` and the first `###` is dropped silently; worth a line in the module comment.

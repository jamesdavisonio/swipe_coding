# web-threads B3 — SDD evidence (implement-feature step 7)

Spec: `docs/features/web-threads.md` §"B3 — Thread view" (criteria 13–15), criterion 2's
"opened by id" clause, cross-cutting 28 (reply half), 29 and 30 on the thread view, and "B3
contract details fixed at test time" · Branch: `feat/web-threads-b3` · Red SHA:
`0bcf6d2ce87092e8daab5c3f40f486a93ae790be`.

## 1. Commits since the red checkpoint (`git log --oneline 0bcf6d2..HEAD`, before this evidence)

```
5e23cec docs: the rebuilt Threads and thread routes, and the B3 components
c2b1e64 fix(web): render an empty bubble for a message with a non-string body
d91f6ec fix(web): survive a hot update of firebase.ts in Vite dev
22db150 refactor(web): one jamesComment builder and replyKind for the write and the optimistic copy
949665c refactor(web): split the thread footer and message bubbles into their own components
ab30e9f feat(web): thread view at /t/:taskId with composer, ticks and stepper
```

## 2. Test files since the red checkpoint

`git diff 0bcf6d2..HEAD -- tests/` → empty (0 bytes). Enforced by the Tier A PreToolUse hook
armed with the red SHA until after the final review (verified: test path exit 2); confirmed
by the orchestrator and the reviewer independently.

## 3. Verbatim outputs

- Red: `red-run.txt` — 7 files failed at import resolution of `pages/Thread.tsx`; the 120
  existing tests passed.
- Green (orchestrator's run at 5e23cec): `green-run.txt` — build, typecheck, lint (0 errors,
  2 pre-existing warnings), `npm test` 205 passed, rules suite and agent protocol in the
  emulator exit 0, audit gate, rules-lint, contrast (38 pairs), prettier — all exit 0.
- Full check: `check-full.md` — READY WITH WARNINGS, 2 MEDIUM.

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: round 1 full audit FAIL (7 gaps, 2 gaming flags) → author repaired
  exactly those → delta check OPEN on one flag and one regression the repair introduced →
  those two repaired → delta check `CLOSED`, 0 regressions. Prompt: `prompt-fidelity.md`.
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context) / build: claude-sonnet (fresh context, not in-session) /
reviewer: claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md` (sha256
  `c58105958d4bcab5…` after the round-1 addendum; `2d63efb9…` at first dispatch); builder
  brief `builder-brief.md` (sha256
  `d909fefd637d3005901f23354e1dedfe07324c2dbd748e36f3ed08a72eb15af6`), `receipt-builder.md`.
  Fidelity and review material was held outside the repo until every build context closed.

## 5. Fresh-context reviewer verdict

`review-round1.md` (needs-changes, 1 issue + follow-ups) → builder fixed the issue and two
follow-ups → scoped re-review `review-final.md`: **VERDICT: shippable**, app 897 / tests 0
since red, duplicated helpers none.

Test-to-app ratio: 1541 test lines (red checkpoint) to 897 app lines, 1.72:1, above the 1.5:1
guide. Justification: B3 covers seven criteria (13, 14, 15, 2, 28, 29, 30); the composer's
keyboard and optimistic-send paths needed snapshot-driven fixtures (pending, rejected and
partial echoes); and the fidelity rounds added the two-send and partial-echo cases that close
the reused-id and text-matching gaming holes.

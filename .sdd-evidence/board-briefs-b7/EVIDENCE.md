# board-briefs B7 — SDD evidence (implement-feature step 7)

Spec: `docs/features/board-briefs.md` §"B7 — Briefs, pull requests and finished-work summaries"
(criteria 31–37), criterion 41 on B7's controls, and "B7 contract details fixed at test time" ·
Branch: `feat/board-briefs-b7` · Red SHA: `23770ca7b061bc9295822bc2e22ebbfde6abe6c1` · Board task
`6nPaiGOWjHdGiYVrzmuR`.

## 1. Commits since the red checkpoint (`git log --oneline 23770ca..HEAD`, before this evidence)

```
0152229 docs: B7 brief components, the PR-ready need, the Done message and where the instructions live
c0fc518 test(board-briefs-b7): reset the clock before faking timers in the Copy test
2d2fcbd refactor(web): share the brief block and pull the spec content out of the spec sheet
0a9c79b feat(web): decision brief cards, one-tap gate replies and suggested next
cd30b94 feat(agent): PR-ready need, Done message and briefs in the session instructions
```

## 2. Test files since the red checkpoint

`git diff 23770ca..HEAD -- tests/` → one approved post-red amendment, nothing else:

```
 tests/board-briefs-b7-36.test.tsx | 3 +++
```

`c0fc518` adds `vi.useRealTimers()` (plus a comment) before the Copy test's own
`vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })`. The shared
`installClock()` had already faked `Date`, and vitest 3.2's `useFakeTimers()` does nothing while
timers are faked, so the test's `setTimeout` stayed real and the frozen test could not pass for any
timer-based implementation. Found by the builder, confirmed by the orchestrator in vitest's source,
escalated with a fix brief (`test-amendment.md`); James replied "fix confirmed" (2026-11-04). No
assertion changed. The Tier A hook was disarmed for that one commit and re-armed at the red SHA.

## 3. Verbatim outputs

- Red: `red-run.txt` — component suite 62 failed, 5 passed (the -37 file fails to load on the
  missing `instructions.ts`); emulator suite 9 failed.
- Builder at 2d2fcbd: every command green except the one defective frozen test (520/521).
- Green (orchestrator's run at 0152229): `green-run.txt` — every command exit 0; `npm test` 48
  files / 521 passed; emulator 16 files / 124 passed; agent protocol "all good"; lint, typecheck,
  build, contrast (38 pairs), rules lint and prettier clean.
- Full check: `check-full.md` — READY WITH WARNINGS.

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: full audit FAIL (8 gaps, 1 gaming flag; `round1-open.md`) → planner
  decisions recorded (commit a706c31) → delta 1 (`b7-delta1.md`) `PASS`. Every check a fresh
  context (skills ADR 0009).
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context per check) / build: claude-sonnet (fresh context) / reviewer:
claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md`; fidelity prompt
  `prompt-fidelity.md`; builder brief `builder-brief.md`; `receipt-builder.md` (both hashes).

## 5. Fresh-context reviewer verdict

`review-final.md`: **VERDICT: shippable** on the first review; app 483 / tests 0 in 23770ca..2d2fcbd,
the approved 3-line test amendment checked separately, no duplicated helpers, five minor
follow-ups.

Test-to-app ratio: 1499 test lines (red checkpoint) to 483 app lines, 3.1:1. Justification: every
criterion is tested in jsdom and the agent's two behaviours against the emulator; the parser is
exercised on malformed briefs (missing, reordered or renamed sub-headings, unknown gate) because a
bad parse must fall back to plain text on James's phone.

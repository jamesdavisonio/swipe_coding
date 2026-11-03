# web-threads B4 — SDD evidence (implement-feature step 7)

Spec: `docs/features/web-threads.md` §"B4 — Decision sheet" (criteria 16–20), cross-cutting 28
(tick half), 29 (the sheet's write-failure state) and 30 on the sheet, the carried-over emulator
tests of `sendReply` and `markRead`, and "B4 contract details fixed at test time" · Branch:
`feat/web-threads-b4` · Red SHA: `9413961b3579902163120975173d2e7dd2c9b0c7` · Board task
`0bFfZ3rbFpTiUIYQcaU1`.

## 1. Commits since the red checkpoint (`git log --oneline 9413961..HEAD`, before this evidence)

```
c96356e docs: decision sheet components, routes and the batch-based ticks in ADR 0003
82ca245 fix(web): cap a change request so its message and history carry the same text
f71f5a1 fix(web): key spec points and after-deploy steps by position as well as text
df29b9f refactor(web): split the spec sheet and drop a lint suppression in the tick hook
817cd3d feat(web): decision sheet for spec, question, PR and after-deploy needs
4c37843 feat(web): decision writes with history, archive overflow and tickStep
```

## 2. Test files since the red checkpoint

`git diff 9413961..HEAD -- tests/` → empty (0 bytes). Enforced by the Tier A PreToolUse hook
armed with the red SHA until after the final review (verified: test path exit 2); confirmed
by the orchestrator and the reviewer independently. `firestore.rules` is also unchanged.

## 3. Verbatim outputs

- Red: `red-run.txt` — component suite 77 failed of 77; emulator suite 35 failed, 45 passed
  (the B1 rules suite plus pre-existing `sendReply`, `markRead` and transaction guards).
- Green (orchestrator's run at c96356e): `green-run.txt` — build, typecheck, lint (0 errors,
  2 pre-existing warnings), `npm test` 282 passed, emulator suite 80 passed, agent protocol in
  the emulator "all good", audit gate, rules-lint, contrast (38 pairs), prettier — all exit 0.
- Full check: `check-full.md` — READY WITH WARNINGS, 2 MEDIUM.

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: round 1 full audit FAIL (5 gaps, 2 gaming flags) → author repaired
  exactly those → delta check `CLOSED`, 0 regressions. Prompt: `prompt-fidelity.md`.
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context) / build: claude-sonnet (fresh context, not in-session) /
reviewer: claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md` (sha256
  `206b2cd43afece48…` after the round-1 addendum; `3dcd898b…` at first dispatch); builder
  brief `builder-brief.md` (sha256
  `16005beabffb9de151a67ea1db99c8b05e5cf9fd46e99774933950b32c1bb6ee`), `receipt-builder.md`.
  Fidelity and review material was held outside the repo until every build context closed.

## 5. Fresh-context reviewer verdict

`review-round1.md`: **shippable** on the first full review, with seven non-blocking follow-ups.
Two cheap ones (duplicate list keys, change-request cap) were fixed by the builder and the
scoped re-check `review-final.md` is **VERDICT: shippable**, app 558 / tests 0 since red,
duplicated helpers none. ADR 0003 was amended for the batch-based ticks (c96356e).

Test-to-app ratio: 2181 test lines (red checkpoint) to 558 app lines, 3.9:1, well above the
1.5:1 guide. Justification: every criterion is tested twice, once as the sheet (jsdom) and once
as the stored documents under the real rules (emulator); the emulator suites also carry the
writes B2 and B3 shipped untested (`sendReply`, `markRead`, `answerQuestion`, `markMerged`),
which were MEDIUM findings in those checks; and the shared emulator fixture is new harness
(154 lines) that B5 and B6 reuse.

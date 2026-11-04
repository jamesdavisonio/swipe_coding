# web-threads B6 — SDD evidence (implement-feature step 7)

Spec: `docs/features/web-threads.md` §"B6 — History and Reopen" (criteria 25–27), cross-cutting
29 and 30 on the History and Reopen sheets, and "B6 contract details fixed at test time" ·
Branch: `feat/web-threads-b6` · Red SHA: `1174a7d6aba438c51466968cda6cb77ab4c5dcc2` · Board task
`gWJ3ovfoAXkz1VIyz24p`.

## 1. Commits since the red checkpoint (`git log --oneline 1174a7d..HEAD`, before this evidence)

```
2939aad docs: decision history and reopen after B6
983cee6 refactor(web): split the Reopen note field out of the sheet
52d3ede feat(web): History sheet entries and the Reopen sheet
cf7f4dd feat(web): reopenTask, useLogArchive and a locale-independent history time
```

## 2. Test files since the red checkpoint

`git diff 1174a7d..HEAD -- tests/` → empty (0 bytes). Enforced by the Tier A PreToolUse hook
(verified: test path exit 2); confirmed by the orchestrator and the reviewer independently.

## 3. Verbatim outputs

- Red: `red-run.txt` — component suite 50 failed, 12 passed (legitimate guards and harness
  self-checks); emulator suite 15 failed (reopenTask / useLogArchive missing).
- Green (orchestrator's run at 2939aad): `green-run.txt` — every command exit 0; `npm test`
  448 passed, emulator 111 passed, agent protocol "all good".
- Full check: `check-full.md` — READY WITH WARNINGS, 1 MEDIUM.

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: full audit FAIL (5 gaps, 4 gaming flags) → four automatic delta rounds
  (open 9 → 4 → 2 → 1 → 1) → the fourth ended without PASS (backstop) → escalated with a round
  decision brief (`escalation.md`) → James: "another round" → delta 5 `PASS`. Every check a fresh
  context (skills ADR 0009). One planner decision recorded before the audit (commit 0b21ea8).
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context per check) / build: claude-sonnet (fresh context) / reviewer:
claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md`; builder brief
  `builder-brief.md`; `receipt-builder.md` (both hashes).

## 5. Fresh-context reviewer verdict

`review-final.md`: **VERDICT: shippable** on the first review, app 412 / tests 0 since red, no
duplicated helpers (two removed), five minor follow-ups.

Test-to-app ratio: 1583 test lines to 412 app lines, 3.8:1, well above the 1.5:1 guide.
Justification: every criterion tested as a sheet (jsdom) and as stored documents (emulator); the
fidelity loop added a foreign time zone and locale harness with a fresh module re-import so the
date format holds on any phone, and focus-return cases for three openers.

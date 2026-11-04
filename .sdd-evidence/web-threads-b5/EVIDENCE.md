# web-threads B5 — SDD evidence (implement-feature step 7)

Spec: `docs/features/web-threads.md` §"B5 — Projects and New task" (criteria 21–24), cross-cutting
29 and 30 on the three screens, and "B5 contract details fixed at test time" · Branch:
`feat/web-threads-b5` · Red SHA: `ae097d1692afd32120e97c014671155b293b9b0f` · Board task
`les2aDkG359pkSNbbCmd`.

## 1. Commits since the red checkpoint (`git log --oneline ae097d1..HEAD`, before this evidence)

```
03ac4c3 docs: Projects, project tabs and New task routes and components after B5
f4334f2 fix(web): render the Type caption as text, not a label for nothing
ea5763e refactor(web): split the project and New task screens into smaller pieces
89e376a feat(web): Projects, project and New task screens (B5)
8cc4e49 refactor(web): share the screen frame, load states, project tile and live-project helper
```

## 2. Test files since the red checkpoint

`git diff ae097d1..HEAD -- tests/` → empty (0 bytes). Enforced by the Tier A PreToolUse hook
armed with the red SHA until after the final review (verified: test path exit 2); confirmed by
the orchestrator and the reviewer independently.

## 3. Verbatim outputs

- Red: `red-run.txt` — 6 component files failed at import resolution of the missing pages;
  emulator suite 11 failed, 84 passed (4 new tests legitimately green: addTodo trim, toggleTodo
  ×2, createTask queued with no live session).
- Green (orchestrator's run at 03ac4c3): `green-run.txt` — every command exit 0; `npm test` 386
  passed, emulator 95 passed, agent protocol "all good".
- Full check: `check-full.md` — READY WITH WARNINGS, 2 MEDIUM.

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: full audit FAIL (5 gaps, 2 gaming flags) → delta 1 FAIL (open 7 → 4) →
  delta 2 FAIL (open 4 → 4, did not shrink) → escalated with a round decision brief → James:
  "another round" → delta 3 `PASS`. Each check a fresh context, per skills ADR 0009.
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context per check) / build: claude-sonnet (fresh context) / reviewer:
claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md` (sha256 `eb636072…` at
  first dispatch, `b2e0ea3c…` final); builder brief `builder-brief.md` (sha256
  `083a96d9169c4b827135697a2a02047533510cffcb0e22810e4f8b1bb0bce17d`), `receipt-builder.md`.

## 5. Fresh-context reviewer verdict

`review-round1.md`: **shippable** on the first full review, eight non-blocking follow-ups. One
(the orphan "Type" label) fixed in f4334f2 and confirmed by a scoped re-check, `review-final.md`:
**VERDICT: shippable**, app 1235 / tests 0 since red, duplicated helpers none.

Test-to-app ratio: 2119 test lines (red checkpoint) to 1235 app lines, 1.72:1, above the 1.5:1
guide. Justification: three screens and two writes across two harnesses (jsdom and emulator);
the fidelity loop added ordering proofs with three-task fixtures and window-edge cases derived
from the shared constants; much of the app diff is moved code from the refactor.

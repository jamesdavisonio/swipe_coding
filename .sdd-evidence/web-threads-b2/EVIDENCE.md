# web-threads B2 — SDD evidence (implement-feature step 7)

Spec: `docs/features/web-threads.md` §"B2 — Threads home" (criteria 6–12), cross-cutting 29
and 30 on Threads and the bottom nav, and "B2 contract details fixed at test time" · Branch:
`feat/web-threads-b2` · Red SHA: `0e803d07def1fa850a443c9cee632d3d30619638`.

## 1. Commits since the red checkpoint (`git log --oneline 0e803d0..HEAD`, before this evidence)

```
a963b1d docs: component tests, feature components and the web logger manifest after B2
3f2c740 fix(web): a row without a valid update time renders without the time
9443c9c fix(web): give the chip scroller room for the focus ring
04f8275 fix(web): a failed Firestore write logs api_call_failed with its error code
9b5f507 fix(web): the browser logger takes its environment from the Vite mode
0e45b19 feat(web): Threads home with project chips, quick replies and bottom nav
14bda12 feat(web): read retry, all-tasks and agents hooks, and the Threads quick-reply writes
815c53b chore(web): shared browser logger wired from app.manifest.yaml
```

## 2. Test files since the red checkpoint

`git diff 0e803d0..HEAD -- tests/` → empty (0 bytes). Enforced by the Tier A PreToolUse hook
(`.claude/hooks/tests-readonly.mjs`) armed with the red SHA until after the final review
(verified: test path exit 2, source path exit 0); confirmed by the orchestrator and the
reviewer independently.

## 3. Verbatim outputs

- Red: `red-run.txt` — 9 files failed at import resolution of the missing modules
  (`pages/Threads.tsx`, `components/BottomNav.tsx`); the 39 existing tests passed.
- Green (orchestrator's run at a963b1d): `green-run.txt` — build, typecheck, lint (0 errors,
  2 pre-existing warnings), `npm test` 120 passed, rules suite and agent protocol in the
  emulator exit 0, audit gate, rules-lint, contrast (38 pairs), prettier — all exit 0.
- Full check: `check-full.md` — READY WITH WARNINGS, 2 MEDIUM.

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: round 1 full audit FAIL (5 gaps, 0 gaming flags) → author repaired
  exactly those gaps → scoped delta check `CLOSED`, 0 regressions (James's rule: repair what
  was found, re-check only that). Prompt: `prompt-fidelity.md`.
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context) / build: claude-sonnet (fresh context, not in-session) /
reviewer: claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md` (sha256
  `a55f3bff8e4c9fb4…` after the round-1 addendum; `2dd98607…` at first dispatch before the
  focus-ring note, `e321b53d…` at dispatch); builder brief `builder-brief.md` (sha256
  `7101b429cdb0ec3635d6b5c312fb2e6263e43a92525d7a0e80f3f3efd585f081`), `receipt-builder.md`.
  Fidelity and review material was held outside the repo until every build context closed.

## 5. Fresh-context reviewer verdict

`review-round1.md` (needs-changes, 2 issues + follow-ups) → builder fixed the 2 issues and 2
follow-ups → scoped re-review `review-final.md`: **VERDICT: shippable**, app 1115 / tests 0
since red, duplicated helpers none. Test-to-app ratio: 1313 test lines (red checkpoint) to
1115 app lines, 1.18:1, within the 1.5:1 guide.

# web-threads B1 — SDD evidence (implement-feature step 7)

Spec: `docs/features/web-threads.md` §"B1 — Shared model" + "B1 contract details fixed at test
time" · ADR: `docs/decisions/0003-stage-model.md` · Branch: `feat/web-threads` · Red SHA:
`1cd460467a6baa982d352fe48181b6bd2e64571a` · Green HEAD at review: `d2e9166`.

## 1. Commits since the red checkpoint (`git log --oneline 1cd4604..HEAD`)

```
d2e9166 fix(web): re-queue guard reads the task's real binding
5954baa docs: fix tools table row, needs wording and ADR 0003 consequences
78976fb refactor(shared): one taskPhase classifier for web status and agent list order
d708eac fix(agent): spec approval is requested by awaiting_approval alone
9faec36 fix(web): guard James's stage transitions in transactions and send approvals as kind approve
05d076b docs: data model, stage chains and test commands after B1
07fd0c4 refactor(shared): taskStages helper replaces repeated stagesFor calls
860ef7a chore(web): keep the Phase 1 pages rendering on the stage model
106e108 feat(agent): map the Phase 1 tools onto the stage model
4496615 feat(shared): export the STAGES list
27348db feat(firebase): rules for comment kinds and log_archive, stage and doneAt indexes
13b7c61 feat(shared): stage model, decision log, delivery state and new task shape
```

`git diff 1cd4604..HEAD --stat` → 15 files changed, 686 insertions(+), 360 deletions(-).

## 2. Test files since the red checkpoint

`git diff 1cd4604..HEAD -- tests/ packages/agent/test/` → empty (0 bytes). Enforced by the
Tier A PreToolUse hook (`.claude/hooks/tests-readonly.mjs`) armed with the red SHA from the
checkpoint until after the final review; verified by the orchestrator, the builder and the
reviewer independently.

## 3. Verbatim outputs

- Red (before the build): `red-unit-run.txt` (37 failed / 2 passed), `red-rules-run.txt`
  (11 failed / 23 passed), `red-agent-run.txt` (agent protocol against the emulator, stops at the
  create brief).
- Green (orchestrator's independent run at HEAD after the review fixes): `green-run.txt` —
  `npm run lint` exit 0 (0 errors, 2 pre-existing warnings), `npm run typecheck` exit 0,
  `npm test` 39 passed, `npm run test:rules` 34 passed, agent protocol in the emulator "all good",
  `node scripts/check-firestore-rules.mjs` passed, `npx prettier --check .` passed.

## 4. Test-fidelity verdict and profile

- Full audits: rounds 1–3 (static rules tests; escalated to the human, who chose to install
  Java), rounds 4–8 (emulator-backed; each FAIL fed back to the author). Final: `fidelity-final.md`
  — scoped delta check of the round-8 repairs, verdict `CLOSED`, 0 regressions. Process change
  recorded there: after round 8 the loop became repair-what-was-found + delta confirmation (James,
  2026-11-03). Round files: `fidelity-round1.md` … `fidelity-round8.md`.
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context per round) / build: claude-sonnet (fresh context, not
in-session) / reviewer: claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test author packet `packet-test-author.md` (sha256
  `19ceaf1226551f57…`, recorded at dispatch) + addendum `packet-rules-test.md`; builder packet
  `receipt-builder.md` (brief sha256 `6365b168909f805e17e99b08bb867138cd3379dc5665bc1738ccf679be51998d`,
  snapshot 1cd4604, `.sdd-evidence/` held outside the repo for the build).

## 5. Fresh-context reviewer verdict

`review-round1.md` (needs-changes, 4 issues) → builder fixes → scoped re-review (3 resolved,
1 regression) → `d2e9166` → `review-final.md`: **VERDICT: shippable**, proportionality app 636 /
tests 0 since red, duplicated helpers none. Non-blocking follow-ups are listed there and in the
PR body.

# app-logs L1 — SDD evidence (implement-feature step 7)

Spec: `docs/features/app-logs.md` (criteria 1–12), "L1 contract details fixed at test time" and
"Test-draft decisions (L1)" · Branch: `feat/app-logs` · Red SHA:
`ff175813394d51a09d618bf1e4740b53055287ea` · Board task `tazG4gc8Gc5MPtTW5YUL`.

## 1. Commits since the red checkpoint (`git log --oneline ff17581..HEAD`, before this evidence)

```
43e98bb fix(agent): give the per-minute slot back when storing a log fails
71af173 docs: app logs in Firestore — ADR 0004, logging.md, kanban_logs in DESIGN and AGENTS
80884e1 feat(agent): store agent failures in the log store and read them with kanban_logs
21d22ed feat(logging): optional transport in the browser logger; store web logs in Firestore
```

## 2. Test files since the red checkpoint

`git diff ff17581..HEAD -- tests/` → empty (0 bytes). Enforced by the Tier A PreToolUse hook
(verified with a payload file: test path exit 2); confirmed by the orchestrator and the reviewer.

## 3. Verbatim outputs

- Red: `red-run.txt` — unit 9 failed, 2 passed (the "logger without a transport behaves as today"
  guards); rules + emulator 60 failed, 160 passed (124 existing tests and 36 rules refusals that
  the catch-all deny already enforces).
- Green: `green-run.txt` — lint, typecheck, `npm test` 51 files / 532 passed, build, contrast,
  rules lint, prettier, audit gate and the agent protocol on the emulator ("all good"), all
  exit 0; `test:rules` 28 files / 227 passed on 3 of 5 runs, the other 2 ending with a vitest
  worker crash and no failing assertion.
- Full check: `check-full.md` — READY WITH WARNINGS, 1 MEDIUM (the worker crash).

## 4. Test-fidelity verdict and profile

- `fidelity-final.md`: full audit FAIL (2 gaps, 2 gaming flags) → delta rounds with the open
  list 4 → 1 → 1 → 1 → 0. Round 2 did not shrink, so it escalated with a round brief
  (`escalation.md`); James: "another round". Round 3 again did not shrink (`escalation-2.md`);
  James: "another round". Delta 4 `PASS`. Every check a fresh context (skills ADR 0009);
  planner decisions recorded before the audit (commit 1f5cde6).
- Profile line: `profile: anthropic-only (context) — test: claude-opus-5-5 / checker:
claude-opus-5-5 (fresh context per check) / build: claude-sonnet (fresh context) / reviewer:
claude-opus-5-5 (fresh context)`.
- Prompt-grounding receipts: test-author packet `packet-test-author.md`; fidelity prompt
  `prompt-fidelity.md`; delta prompts `delta1-prompt.md` … `delta4-prompt.md`; builder
  brief `builder-brief.md`; `receipt-builder.md` (both hashes). The session restarted between
  delta 3 and delta 4; the test author and the working files carried over unchanged.

## 5. Fresh-context reviewer verdict

`review-final.md`: review 1 **needs-changes** (one issue: a failed store kept its cap slot) → fix
`43e98bb` by the builder → scoped re-review **VERDICT: shippable**. Four non-blocking follow-ups.

Test-to-app ratio: 1839 test lines (red checkpoint) to 563 app lines, 3.3:1. Justification: one
rules row per event-shape case (criterion 5), a self-contained stdio/emulator agent harness (no
reusable one existed), and the per-minute cap needed four timing probes to rule out every cheap
fixed-window variant.

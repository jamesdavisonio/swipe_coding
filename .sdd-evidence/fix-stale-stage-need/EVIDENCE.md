# fix-stale-stage-need — evidence (fix → implement-feature, class Small)

Fix spec: the red-checkpoint commit message (`git show -s b3ac3cb`), confirmed by James
("fix confirmed", 2026-11-05, in the session; the same fix brief was posted on the board) ·
Branch `fix/stale-stage-need` · Red SHA `b3ac3cb72e7bc1241dfe87a1b1b3d38d6458ba3d` · Board task
`1qDf6pVRGNY1xOsaEpSI`.

1. Commits since red: `59a8559 fix(agent): clear the need of every stage a task jumps past`.
2. `git diff b3ac3cb..HEAD -- tests/` → empty (Tier A hook armed at b3ac3cb).
3. Outputs: red (orchestrator, before the fix) — `tests/emulator/fix-stale-stage-need.test.ts`
   3 failed, 3 passed (`expected { kind: 'pr' } to be null` ×2, `expected { kind: 'spec' } to be
null`); green — `green-run.txt`: lint, typecheck, `npm test` 51 files / 532, build,
   `test:rules` 29 files / 233, agent protocol "all good", rules lint, prettier, all exit 0.
4. Test authorship: the repro was written by the debug hop (orchestrator, role `plan`); no
   separate fidelity gate for a Small fix's repro. Profile `anthropic-only (context)` — debug:
   claude-opus-5-5 / build: claude-sonnet (fresh context, `builder-brief.md`) / reviewer:
   claude-opus-5-5 (fresh context).
5. Reviewer: `review-final.md` — **VERDICT: shippable**, three non-blocking follow-ups.

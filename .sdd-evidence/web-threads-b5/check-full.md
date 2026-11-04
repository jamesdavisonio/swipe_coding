CHECK REPORT — full — 2026-11-04 10:30

Diff: 55 files changed, 3450+/804- (main..HEAD, HEAD 03ac4c3; app diff since red ae097d1: 1235+/783-)
Base: main (7f4ed76)
Profile: kanban (gate_stage=ui-ready)
Red-checkpoint SHA: ae097d1 — `git diff ae097d1..HEAD -- tests/` → 0 bytes; `firestore.rules` and `logging/` unchanged

── Fast ──
build PASS exit 0 (npm run build:web — ✓ built in 4.06s; pre-existing chunk-size warning)
typecheck PASS exit 0 (agent, web, root tsconfig)
lint PASS exit 0 (0 errors, 0 warnings — the two Phase 1 autoFocus warnings left with the retired pages)
unit tests PASS exit 0 (vitest: 35 files, 386 tests)

── Full ──
integration PASS exit 0 — emulator suite (rules + web data layer): 95 tests; agent protocol in emulator ("all good")
audit gate PASS exit 0 — 1 high advisory, allowlisted until 2027-02-01 (GHSA-m9gg-hp2v-232j)
rules-lint PASS exit 0
contrast PASS exit 0 (38 pairs, :root + .dark)
format PASS exit 0 (prettier --check .)
secrets PASS 0 hits (added lines); no .env files in diff
stray PASS 0 findings
diff sanity PASS no @ts-ignore/as any/eslint-disable/empty catch added (a bare `.catch(() => {})` was removed); largest changed file 440 lines (data.ts); new components under 125 lines; functions under 50 lines (reviewer-verified)
tampering PASS tests unchanged since red SHA (0 bytes)
logging PASS no console.* added; events used: user_action (queue_task, todo_add, todo_done, todo_undone), milestone_reached (task_queued), api_call_failed, feature_error — all in logging/taxonomy.json

VERDICT: READY WITH WARNINGS — 0 CRITICAL, 0 HIGH, 2 MEDIUM
BLOCKING: none.

Findings:

1. [MEDIUM] packages/web/src/pages — the Phase 1 sign-out control left with the retired TopBar; an owner cannot sign out from the app (not in the spec or prototype). Fix: decide whether to add a sign-out control in a later change (For James item).
2. [MEDIUM] packages/web/src/pages — Projects, the project tabs and New task have not been seen in a browser (light/dark, focus ring, layout). Fix: look at them on the phone after deploy.

```json
{
  "findings": [
    {
      "severity": "MEDIUM",
      "file": "packages/web/src/pages",
      "line": 0,
      "issue": "sign-out control removed with the Phase 1 TopBar; owner cannot sign out",
      "fix": "decide on a sign-out control in a later change"
    },
    {
      "severity": "MEDIUM",
      "file": "packages/web/src/pages",
      "line": 0,
      "issue": "the three new screens not checked in a browser",
      "fix": "view them on the phone in light and dark after deploy"
    }
  ]
}
```

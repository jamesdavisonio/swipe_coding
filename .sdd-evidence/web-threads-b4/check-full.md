CHECK REPORT — full — 2026-11-03 13:40

Diff: 34 files changed, 2834+/53- (main..HEAD, HEAD c96356e; app diff since red 9413961: 558+/44-)
Base: main (39d9244)
Profile: kanban (gate_stage=ui-ready)
Red-checkpoint SHA: 9413961 — `git diff 9413961..HEAD -- tests/` → 0 bytes; `firestore.rules` unchanged

── Fast ──
build PASS exit 0 (npm run build:web — ✓ built in 4.15s; pre-existing chunk-size warning)
typecheck PASS exit 0 (agent, web, root tsconfig)
lint PASS exit 0 — 0 errors, 2 warnings (jsx-a11y/no-autofocus in Board.tsx/Home.tsx, pre-existing lines)
unit tests PASS exit 0 (vitest: 29 files, 282 tests)

── Full ──
integration PASS exit 0 — emulator suite (rules + web data layer): 8 files, 80 tests; agent protocol in emulator ("all good", exit 0)
audit gate PASS exit 0 — 1 high advisory, allowlisted until 2027-02-01 (GHSA-m9gg-hp2v-232j)
rules-lint PASS exit 0 (scripts/check-firestore-rules.mjs)
contrast PASS exit 0 (38 pairs, :root + .dark)
format PASS exit 0 (prettier --check .)
secrets PASS 0 hits (added lines); no .env files in diff
stray PASS 0 findings
diff sanity PASS no @ts-ignore/as any/eslint-disable/empty catch added; largest changed file 417 lines (data.ts); largest new component 126 lines (SpecDecision.tsx); functions under 50 lines (reviewer-verified)
tampering PASS tests unchanged since red SHA (0 bytes)
logging PASS no console.* added; events used: user_action, milestone_reached, api_call_failed, feature_error — all in logging/taxonomy.json; logging/ untouched

VERDICT: READY WITH WARNINGS — 0 CRITICAL, 0 HIGH, 2 MEDIUM
BLOCKING: none.

Findings:

1. [MEDIUM] packages/web/src/data.ts — tickStep writes afterDone from the screen's copy in a batch: two devices ticking at once can lose a tick, and a stale screen can complete an already-done task again (second Done entry and closing message). Accepted in the B4 contract for offline ticks (ADR 0003 amended). Fix: add a rules-level stage check on afterDone updates, or re-derive on the server side, in a later change.
2. [MEDIUM] packages/web/src/components/DecisionSheet.tsx — the sheet's light/dark rendering, focus ring and layout were not checked in a browser (the app sits behind the Google auth gate). Fix: look at each sheet on the phone in both themes before the rebuilt app is deployed.

```json
{
  "findings": [
    {
      "severity": "MEDIUM",
      "file": "packages/web/src/data.ts",
      "line": 0,
      "issue": "tickStep batch from the screen's afterDone can lose a concurrent tick and re-complete a done task from a stale screen",
      "fix": "add a rules-level stage check on afterDone updates, or re-derive server-side, in a later change"
    },
    {
      "severity": "MEDIUM",
      "file": "packages/web/src/components/DecisionSheet.tsx",
      "line": 0,
      "issue": "light/dark rendering, focus ring and layout of the sheet not checked in a browser",
      "fix": "view each sheet on the phone in both themes before the rebuilt app is deployed"
    }
  ]
}
```

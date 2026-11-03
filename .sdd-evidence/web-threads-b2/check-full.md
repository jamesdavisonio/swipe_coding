CHECK REPORT — full — 2026-11-03 09:01

Diff: 41 files changed, 3175+/26- (main..HEAD, HEAD a963b1d; app diff since red 0e803d0: 1115 lines added excluding package-lock.json)
Base: main (aca160a)
Profile: kanban (gate_stage=ui-ready)
Red-checkpoint SHA: 0e803d0 — `git diff 0e803d0..HEAD -- tests/` → 0 bytes

── Fast ──
build PASS exit 0 (npm run build:web — ✓ built in 4.15s; pre-existing chunk-size warning)
typecheck PASS exit 0 (agent, web, root tsconfig)
lint PASS exit 0 — 0 errors, 2 warnings (jsx-a11y/no-autofocus in Board.tsx/Home.tsx, pre-existing lines)
unit tests PASS exit 0 (vitest: 15 files, 120 tests)

── Full ──
integration PASS exit 0 — rules in emulator (Script exited successfully, code 0); agent protocol in emulator (Script exited successfully, code 0)
audit gate PASS exit 0 — 1 high advisory, allowlisted until 2027-02-01 (GHSA-m9gg-hp2v-232j)
rules-lint PASS exit 0 (scripts/check-firestore-rules.mjs)
contrast PASS exit 0 (38 pairs, :root + .dark)
format PASS exit 0 (prettier --check .)
secrets PASS 0 hits (added lines, key/token/private-key/password patterns); no .env files in diff
stray PASS 0 findings (.only/.skip/xit/debugger/console.log/TODO-fix-before-merge in added lines)
diff sanity PASS no @ts-ignore/as any/eslint-disable/empty catch added; largest changed file 359 lines (data.ts); Threads() split to ~45 lines (reviewer-verified); constants named
tampering PASS tests unchanged since red SHA (0 bytes)
logging PASS no console.* added under packages/; events used: user_action, api_call_failed, feature_error — all in logging/taxonomy.json; manifest values from app.manifest.yaml via virtual module, env from Vite mode; logging/ untouched

VERDICT: READY WITH WARNINGS — 0 CRITICAL, 0 HIGH, 2 MEDIUM
BLOCKING: none.

Findings:

1. [MEDIUM] packages/web/src/data.ts — the new writes (answerQuestion, markMerged, markRead) are tested only as dispatch from Threads (data.ts mocked); their Firestore effects are untested. Fix: cover them in the B4 emulator-backed acceptance tests, as the contract assigns.
2. [MEDIUM] packages/web/src/components/ProjectChips.tsx — the visible focus ring, light/dark rendering and layout of the new screen were not checked in a browser (the app sits behind the Google auth gate; criterion 30's ring is not observable in jsdom). Fix: look at Threads on the phone in both themes before the rebuilt app is deployed.

```json
{
  "findings": [
    {
      "severity": "MEDIUM",
      "file": "packages/web/src/data.ts",
      "line": 0,
      "issue": "new writes answerQuestion, markMerged, markRead are tested only as dispatch; their Firestore effects are untested",
      "fix": "cover them in the B4 emulator-backed acceptance tests"
    },
    {
      "severity": "MEDIUM",
      "file": "packages/web/src/components/ProjectChips.tsx",
      "line": 0,
      "issue": "focus ring, light/dark rendering and layout of Threads not checked in a browser",
      "fix": "view Threads on the phone in both themes before the rebuilt app is deployed"
    }
  ]
}
```

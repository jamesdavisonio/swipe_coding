# app-logs L1 — fidelity gate (delta loop per skills ADR 0009)

Full audit (fresh context, claude-opus): FAIL — 2 gaps, 2 gaming flags; criteria 1–12 all
mapped; grounding and hygiene clean; red valid (9 unit failures; every app-logs emulator test
fails for missing behaviour; the 2 unit passes and 36 rules refusals are legitimate guards).
Open list verbatim in round1-open.md. Planner decisions recorded before the audit in
docs/features/app-logs.md ("Test-draft decisions (L1)", commit 1f5cde6).

Delta 1 (fresh context): FAIL — gap 1 and gap 2 closed, gaming flag 2 closed, gaming flag 1's
listed stub caught; an equally cheap variant (window anchored at the first stored event) still
passes. Open list 4 → 1 (round2-open.md), so round 2 runs automatically.

Delta 2 (fresh context): FAIL — the anchored-window flag closed (modelled across 600 start
seconds), but a new variant of the same stub passes: a tumbling 60 s window at an arbitrary
phase (first-event grid 200/600 runs; clock grid shifted 30 s 596/600). Open list 1 → 1, did
not shrink, so the loop escalates to James with a round brief (escalation.md).
James: "another round" (2026-11-04, in the session; same brief posted on the board as a question).

Delta 3 (fresh context): FAIL — the tumbling-window flag closed (rolling passes 1200/1200
phases; anchored and phase-shifted 60 s grids fail at every phase), but a clock-aligned
sub-bucket window (e.g. two 30 s buckets) passes all five tests because every probe sits on a
whole minute. Open list 1 → 1, did not shrink: escalated to James again (escalation-2.md).
James: "another round" again (2026-11-05, in the session; last automatic round).

Delta 4 (fresh context):

```json
{
  "verdict": "PASS",
  "criteria_map": [
    {
      "criterion": 7,
      "tests": [
        "tests/emulator/app-logs-7.test.ts: stores 20 in a minute; every one is still written to stderr",
        "tests/emulator/app-logs-7.test.ts: stores again once the minute has rolled on",
        "tests/emulator/app-logs-7.test.ts: the minute is rolling, not the clock minute",
        "tests/emulator/app-logs-7.test.ts: the window rolls with each event, not from the first one",
        "tests/emulator/app-logs-7.test.ts: a steady trickle fills the window whatever the clock phase"
      ],
      "status": "mapped; repair line keeps mapping and assertions intact"
    }
  ],
  "gaps": [],
  "gaming_flags": []
}
```

Open list 4 → 1 → 1 → 1 → 0 across four delta rounds (James: "another round" twice). Reviewer
notes: 2 s clock buckets can store ~40 events in ~58 s at the edges (accepted as effectively
correct); window length pinned to 58.5–61 s.

# board-briefs B7 — fidelity gate (delta loop per skills ADR 0009)

Full audit (fresh context, claude-opus): FAIL — 8 gaps, 1 gaming flag; criteria 31–37 and 41
(B7's controls) mapped; red valid (59 component failures, -37 fails to load on the missing
instructions.ts, 10 emulator failures; passes at red are existing behaviour). Gaming flag: the
"no second Done message" test never reached the already-done guard (done unbinds the task). See
round1-open.md for the verbatim list. Planner decisions recorded in docs/features/board-briefs.md
("Fidelity round 1 decisions (B7)", commit a706c31).

Delta 1 (fresh context):

```json
{
  "verdict": "PASS",
  "criteria_map": [
    {
      "criterion": 31,
      "tests": [
        "tests/board-briefs-b7-31.test.tsx (parseBrief + thread card; repaired: before/after with --- and card excludes AFTER and the Reply line)"
      ]
    },
    { "criterion": 32, "tests": ["tests/board-briefs-b7-32.test.tsx (untouched)"] },
    {
      "criterion": 33,
      "tests": [
        "tests/board-briefs-b7-33.test.tsx (row/sheet label title, phrase button, answerQuestion once, gate_reply; new: row rejection logs api_call_failed under tap request_id; sheet rejection shows SAVE_ERROR alert, stays open, onClose not called)"
      ]
    },
    {
      "criterion": 34,
      "tests": [
        "tests/emulator/board-briefs-b7-34.test.ts (agent PR need, untouched)",
        "tests/board-briefs-b7-34.test.tsx (latest summary brief card above PR content and above the task summary; new: latest summary brief still shown when plainer messages follow; no brief -> summary only)"
      ]
    },
    {
      "criterion": 35,
      "tests": [
        "tests/emulator/board-briefs-b7-35.test.ts (Done message + unread; repaired: still-bound already-done task gets no second Done message and unread unchanged)",
        "tests/board-briefs-b7-35.test.tsx (untouched)"
      ]
    },
    {
      "criterion": 36,
      "tests": [
        "tests/board-briefs-b7-36.test.tsx (suggestedNext; list + Copy buttons; repaired: Copied for 2 s then Copy via fake timers; copy_suggestion with non-empty request_id; nothing started)"
      ]
    },
    {
      "criterion": 37,
      "tests": [
        "tests/board-briefs-b7-37.test.ts (rules per paragraph; repaired: done rule requires one-per-line and follow-ups; initialize over offline stdio returns SESSION_INSTRUCTIONS)"
      ]
    },
    { "criterion": 41, "tests": ["tests/board-briefs-b7-41.test.tsx (untouched)"] }
  ],
  "gaps": [],
  "gaming_flags": []
}
```

Notes for the code reviewer: -33 request_id checks compare without asserting presence (track
always stamps one); the row rejection test does not assert that no alert shows on the row; -37
fails to load as a whole at red because of its static import.

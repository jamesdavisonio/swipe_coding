# B7 fidelity round 1 — open list (verbatim from the full audit)

gaps:

1. weak-assertion — tests/emulator/board-briefs-b7-35.test.ts::writes no second Done message for a task that is already done — donePatch unbinds the task (agentId null), so the repeat updateTask throws in assertMine before any write and the 'a task already done writes no second message' guard is never exercised. Fix: a still-bound task with stage 'done'; updateTask({status:'done', summary}); assert zero kind-done comments and unread unchanged.
2. hygiene — tests/board-briefs-b7-37.test.ts::is what the MCP server sends: index.ts passes SESSION_INSTRUCTIONS from instructions.ts — regex over index.ts source (structural), although protocol.ts shows an offline spawn that reads initialize's instructions without a real key. Fix: spawn the agent and assert initialize's instructions equal SESSION_INSTRUCTIONS.
3. weak-assertion — tests/board-briefs-b7-31.test.tsx::shows the text before the brief above the card and the text after it below — the AFTER paragraph after a blank line with no heading is a continuation of agreeing by the parse rule; order-only checks can't tell after-below-the-card from after-inside-it. Fix: a heading or '---' before AFTER and assert AFTER and the Reply line render outside the card element.
4. weak-assertion — tests/board-briefs-b7-34.test.tsx::shows the session's latest summary brief as a card above the PR content — doesn't check the task summary still shows below the card. Fix: assert the summary is shown and the card heading comes before it.
5. missing-edge-case — criterion 34 — no case with a plain session message newer than the summary brief. Fix: add it and assert the latest summary brief card still shows (planner reading confirmed in the contract).
6. missing-edge-case — criterion 33 — no error path for the one-tap answer and no request_id check on gate_reply or copy_suggestion taps. Fix: a rejection test with the B4 helpers (api_call_failed, target firestore, status code, request_id equal to the tap's); request_id on copy_suggestion; failure action name fixed in the contract.
7. weak-assertion — tests/board-briefs-b7-36.test.tsx::Copy writes the item to the clipboard and shows Copied on that button — nothing checks Copied reverts. Fix: bound fixed by the planner (two seconds); advance fake timers and assert Copy again.
8. weak-assertion — tests/board-briefs-b7-37.test.ts::says to finish with status done and a summary ending with ### Suggested next — keywords only; doesn't require 'one per line' or the follow-ups condition. Fix: require /one (suggestion )?per line/i and /follow-?ups?/i.

gaming_flags:

- tests/emulator/board-briefs-b7-35.test.ts::writes no second Done message for a task that is already done — stub: write a kind-done comment whenever input.status === 'done' with no already-done check; the second call fails in assertMine because the first unbound the task.

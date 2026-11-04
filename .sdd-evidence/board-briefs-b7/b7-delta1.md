You are re-checking a repair to acceptance tests. A previous audit listed
specific problems; the test author has repaired them. You did not write
these tests, and the implementation is withheld.

Inputs I am giving you:

1. The feature spec: docs/features/board-briefs.md, section "B7 — Briefs, pull requests and
   finished-work summaries" and the "B7 contract details fixed at test time" block INCLUDING the
   new paragraph "Fidelity round 1 decisions (B7)" (PR sheet uses the most recent summary brief
   even when plainer messages follow; one-tap answer through `track` as `gate_reply`, a failure
   logs api_call_failed with the tap's request_id, the sheet shows the B4 alert and stays open,
   a row only logs; copy_suggestion through track; `Copied` for two seconds then `Copy`; the done
   instruction says one suggestion per line when there are follow-ups).
2. The repaired test files (uncommitted): tests/board-briefs-b7-_.test.ts(x),
   tests/emulator/board-briefs-b7-_.test.ts, and the fixtures tests/fixtures/board-briefs-b7*.
3. The open list (previous round, verbatim):
   C:\Users\Intel\AppData\Local\Temp\claude\C--Users-Intel-Documents-code-kanban\15399a86-1ff4-4831-8392-e476864b21fd\scratchpad\ev-b7\round1-open.md
4. The repair (untracked files; the author's change list):
   1. emulator -35 "writes no second Done message…": taskAt builds a still-bound bugfix at stage
      done (doneAt a minute ago, needs null, working false, unread false); one
      updateTask({status:'done', summary}) with .catch; asserts no kind-done comment and unread
      still false. (It passes at red: today's updateTask writes no comment.)
   2. -37 "is what the MCP server sends: initialize returns SESSION_INSTRUCTIONS": spawns
      packages/agent/src/index.ts offline like packages/agent/test/protocol.ts (child env
      KANBAN_SA = the test file itself, not a key; FIRESTORE_EMULATOR_HOST and KANBAN_TEST_LIVE
      deleted; KANBAN_PROJECT_ID demo-kanban), sends initialize, asserts
      result.instructions === SESSION_INSTRUCTIONS.
   3. -31 before/after: the after text is now `---`, blank line, AFTER and the Reply line; the
      card is the smallest element around the Fix heading holding the last part; asserts it
      holds the last part but neither AFTER nor the Reply line.
   4. -34 (web) latest summary brief: also asserts the task summary is shown after the card
      heading.
   5. -34 (web) new "still shows the latest summary brief when plainer messages came after it"
      (summary brief, then James's "ship it", then session "PR is up.").
   6. -33 two new tests (B4 failures/tapRequestId/SAVE_ERROR, B3 deniedWrite): a rejected phrase
      answer on a Threads row logs api_call_failed (gate_reply, target firestore, status
      permission-denied, same request_id as the tap); in the sheet, the alert shows, the dialog
      stays open, onClose not called, same api_call_failed. -36 copy_suggestion asserts a
      non-empty request_id.
   7. -36 Copied: fake Date/setTimeout/clearTimeout, fireEvent.click, act(advanceTimersByTimeAsync):
      Copied at 0 and 1999 ms, Copy (not Copied) at 2000 ms.
   8. -37 done rule also requires /one (suggestion )?per line/i and /follow-?ups?/i.
5. The grounded packet:
   C:\Users\Intel\AppData\Local\Temp\claude\C--Users-Intel-Documents-code-kanban\15399a86-1ff4-4831-8392-e476864b21fd\scratchpad\packet-test-author-b7.md

Check only two things:

- For each item on the open list: is it now closed? For a gaming flag, try
  the listed stub again and any equally cheap variant against the repaired
  test.
- For each line the repair touched: did it break a criterion mapping,
  weaken an assertion, add a hygiene violation, or open a new stub? Report
  those as new gaps.

Do not audit tests or lines the repair did not touch. If you notice a real problem outside the
repair, mention it in the summary as a note for the code reviewer; it never goes in gaps[] and
never costs another round.

Output: a short summary, then exactly one fenced JSON object, last in your message:
{"verdict": "PASS" | "FAIL", "criteria_map": [...], "gaps": [...], "gaming_flags": [...]}
PASS only when gaps[] and gaming_flags[] are both empty.

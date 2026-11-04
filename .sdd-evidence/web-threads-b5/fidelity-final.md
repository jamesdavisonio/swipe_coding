# web-threads B5 — fidelity gate (delta loop per skills ADR 0009)

Full audit (fresh context, claude-opus): FAIL — 5 gaps, 2 gaming flags; every criterion
(21–24, 29 and 30 on the three screens) mapped to non-tautological tests; red valid (6
component files at import resolution of the missing pages; emulator 11 failed, 4 passing at
red legitimately: addTodo trim, toggleTodo ×2, createTask agentId null). Gaming flags: Done
and Show older lists in received order with no doneAt sort. Gaps: those two orderings; stale
and week window edges; criterion-24 emulator test in the -23 file; untick action unpinned.
Planner decisions recorded in docs/features/web-threads.md ("Fidelity round 1 decisions (B5)",
commit 649c7d7): `todo_undone`; queue_task logged after createTask resolves; windows are the
shared constants. A planner note added to the repair: stale agents derived from AGENT_STALE_MS
so the heartbeat fix (PR 12, stale 12 min) cannot break the tests.

Delta round 1 (fresh context): FAIL — 3 of 5 gaps closed; the two ordering gaps and both flags
open (two-item buckets pass by reversing the received order). Open list 7 → 4.
Delta round 2 (fresh context): FAIL — reversal and updatedAt sorts now caught; a sort by task id
still passes (ids named in doneAt order). Open list 4 → 4: did not shrink → escalated to James
with a round decision brief. James: "another round" (2026-11-04).
Delta round 3 (fresh context):

```json
{
  "verdict": "PASS",
  "criteria_map": [
    {
      "criterion": "22 (Done: newest doneAt first within 7 days)",
      "tests": [
        "B5-22 Done > sorts this week by doneAt, newest first, whatever order the tasks arrive in",
        "B5-22 Done > lists the tasks done within 7 days, newest first, with title, summary and when"
      ]
    },
    {
      "criterion": "22 (Done: Show <N> older reveals the rest below, newest first)",
      "tests": [
        "B5-22 Done > sorts the older ones by doneAt, newest first, whatever order they arrive in",
        "B5-22 Done > Show <N> older reveals the rest below, newest first, and becomes Hide <N> older"
      ]
    }
  ],
  "gaps": [],
  "gaming_flags": []
}
```

Note for the code reviewer (outside the repair, from the delta checks): the comment above TASKS in
tests/web-threads-b5-22.test.tsx overclaims that only a doneAt sort orders k-d1/k-d2; the
ordering proof lives in the two dedicated three-task tests. ONLINE agents sit at a third of the
stale window, so only the "just past" edge is pinned.

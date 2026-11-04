You are re-checking a repair to acceptance tests. A previous audit listed
specific problems; the test author has repaired them. You did not write
these tests, and the implementation is withheld.

Inputs I am giving you:

1. The feature spec: docs/features/web-threads.md, section "B5 — Projects and New task"
   (criteria 21–24), shared criteria 29–30 on the three B5 screens, and the "B5 contract
   details fixed at test time" block INCLUDING the new paragraph "Fidelity round 1 decisions
   (B5)" (untick action `todo_undone`; `queue_task` logged after createTask resolves with the
   milestone's request id; windows are the shared constants AGENT_STALE_MS / DONE_VISIBLE_MS).
2. The repaired test files (all uncommitted; `git status` lists them): tests/web-threads-b5-_.test.tsx,
   tests/emulator/web-threads-b5-_.test.ts, tests/fixtures/web-threads-b5.tsx,
   tests/fixtures/web-threads-b5-emulator.ts.
3. The open list (previous round, verbatim):

   gaps:
   - weak-assertion — tests/web-threads-b5-22.test.tsx::B5-22 Done > lists the tasks done within 7 days, newest first, with title, summary and when — TASKS already lists k-d1 (2 d) before k-d2 (3 d), both share updatedAt NOW-DAY, and the fixture's useProjectTasks does not sort, so the expected order is the unsorted input order and "newest doneAt first" is never exercised. Fix: seed the done tasks out of doneAt order.
   - weak-assertion — tests/web-threads-b5-22.test.tsx::B5-22 Done > Show <N> older reveals the rest below, newest first, and becomes Hide <N> older — k-o1 (9 d) already precedes k-o2 (20 d) with equal updatedAt, so newest-first passes without sorting. Fix: put k-o2 first or give it the newer updatedAt.
   - missing-edge-case — criterion 21 — online and stale agents are 10 s and 10 min old, done tasks 2–3 d vs 9–20 d, so a wrong stale window or a wrong week window still passes the live dot, sessions-live count and done this week. Fix: an agent just past the stale window and a done task just inside / outside 7 days.
   - hygiene — tests/emulator/web-threads-b5-23.test.ts::B5-24 createTask with no live session — the criterion-24 emulator test lives in the criterion-23 file. Fix: move it to tests/emulator/web-threads-b5-24.test.ts.
   - weak-assertion — tests/web-threads-b5-22.test.tsx::B5-22 For James > unticking a done todo … logs the untick — any action name passes. Fix: planner pins the name; assert it exactly.
     gaming_flags:
   - B5-22 Done newest-first: a Done tab rendered in the order received, with no sort by doneAt, passes.
   - B5-22 Show older: an older list in the order received, with no sort, passes.

4. The repair (the tests are untracked, so this is the author's exact change list, not a git diff):
   - tests/fixtures/web-threads-b5.tsx: imports AGENT_STALE_MS and DONE_VISIBLE_MS; ONLINE = Math.floor(AGENT_STALE_MS / 3) (was 10_000); STALE = AGENT_STALE_MS + 1_000 (was 10 min); JUST_INSIDE_WEEK = DONE_VISIBLE_MS − MINUTE; JUST_OUTSIDE_WEEK = DONE_VISIBLE_MS + MINUTE; pastWeek(days) = DONE_VISIBLE_MS + days·DAY; agent() comment updated.
   - tests/web-threads-b5-21.test.tsx: k-old done at NOW − pastWeek(3); "does not count a need on a task that finished more than a week ago" uses pastWeek(3); new tests "an agent seen just past AGENT_STALE_MS ago is not live and not counted" and "counts a task done just inside DONE_VISIBLE_MS, not one done just outside it" (k-out seeded first).
   - tests/web-threads-b5-22.test.tsx: TASKS seeds k-d2 before k-d1 with k-d2 the newer updatedAt (NOW−2h vs NOW−2d), and k-o2 before k-o1 with k-o2 the newer updatedAt (NOW−3h vs NOW−pastWeek(2)); k-o1/k-o2 done at pastWeek(2)/pastWeek(13); expected orders unchanged; new test "lists a task done just inside DONE_VISIBLE_MS and keeps one just outside behind Show older"; the untick test now asserts action === 'todo_undone'.
   - tests/web-threads-b5-29.test.tsx and -30.test.tsx: older done tasks use pastWeek(2).
   - tests/emulator/web-threads-b5-23.test.ts: the B5-24 describe removed; new tests/emulator/web-threads-b5-24.test.ts holds it unchanged.

5. logging/taxonomy.json and the grounded packet:
   C:\Users\Intel\AppData\Local\Temp\claude\C--Users-Intel-Documents-code-kanban\15399a86-1ff4-4831-8392-e476864b21fd\scratchpad\packet-test-author-b5.md

Check only two things:

- For each item on the open list: is it now closed? For a gaming flag, try
  the listed stub again and any equally cheap variant against the repaired
  test.
- For each line the repair touched: did it break a criterion mapping,
  weaken an assertion, add a hygiene violation, or open a new stub? Report
  those as new gaps.

Do not audit tests or lines the repair did not touch. Do not raise new
nits outside the repair; this is not a fresh audit. If you notice a real
problem outside it anyway, mention it in the summary as a note for
the code reviewer. It never goes in gaps[] and never costs another round.

Output: a short summary, then exactly one fenced JSON object, last in your message:
{"verdict": "PASS" | "FAIL", "criteria_map": [...], "gaps": [...], "gaming_flags": [...]}
gaps[] and gaming_flags[] hold only items still open plus regressions from the repair.
PASS only when both lists are empty.

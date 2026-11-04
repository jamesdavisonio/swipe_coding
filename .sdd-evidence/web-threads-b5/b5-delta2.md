You are re-checking a repair to acceptance tests. A previous audit listed
specific problems; the test author has repaired them. You did not write
these tests, and the implementation is withheld.

Inputs I am giving you:

1. The feature spec: docs/features/web-threads.md, section "B5 — Projects and New task"
   (criterion 22: "Done = done within 7 days, with Show older revealing the rest, newest
   first") and the "B5 contract details fixed at test time" block (Done: "tasks done within 7
   days, newest doneAt first … a button Show <N> older reveals them below (newest first)").
2. The repaired test file: tests/web-threads-b5-22.test.tsx (uncommitted), describe
   'B5-22 Done', and the fixture tests/fixtures/web-threads-b5.tsx it uses.
3. The open list (previous round, verbatim):
   gaps:
   - weak-assertion — tests/web-threads-b5-22.test.tsx::B5-22 Done > lists the tasks done within 7 days, newest first (and 'the tabs > opens on the tab the URL names') — two done tasks seeded in reverse doneAt order with updatedAt anti-correlated to doneAt: reversing the received order, or sorting by updatedAt ascending, yields the expected order without any doneAt sort. Fix: a dedicated test with three tasks whose received order, its reverse, updatedAt desc and updatedAt asc all differ from doneAt-desc.
   - weak-assertion — tests/web-threads-b5-22.test.tsx::B5-22 Done > Show <N> older reveals the rest below, newest first — same problem for the older bucket. Same fix.
     gaming_flags:
   - B5-22 Done newest-first: render the within-week tasks in reverse of the order received (or updatedAt ascending), no doneAt sort.
   - B5-22 Show older: render the older list in reverse of the order received (or updatedAt ascending), no doneAt sort.
4. The repair (untracked file, so the author's change list rather than a git diff): two new
   tests added inside describe('B5-22 Done'), after "has no Show older button when nothing
   older exists"; nothing else changed:
   - "sorts this week by doneAt, newest first, whatever order the tasks arrive in": received
     k-d2 (doneAt NOW−3d, updatedAt NOW−2h), k-d1 (NOW−2d, NOW−2d), k-d3 (NOW−4d, NOW−3d);
     expects /t/k-d1, /t/k-d2, /t/k-d3.
   - "sorts the older ones by doneAt, newest first, whatever order they arrive in": no
     within-week tasks; received k-o2 (NOW−pastWeek(3), NOW−2h), k-o1 (NOW−pastWeek(1),
     NOW−pastWeek(1)), k-o3 (NOW−pastWeek(5), NOW−pastWeek(5)); taps Show 3 older; expects
     /t/k-o1, /t/k-o2, /t/k-o3.
5. The grounded packet:
   C:\Users\Intel\AppData\Local\Temp\claude\C--Users-Intel-Documents-code-kanban\15399a86-1ff4-4831-8392-e476864b21fd\scratchpad\packet-test-author-b5.md

Check only two things:

- For each item on the open list: is it now closed? For a gaming flag, try
  the listed stub again and any equally cheap variant against the repaired
  test.
- For each line the repair touched: did it break a criterion mapping,
  weaken an assertion, add a hygiene violation, or open a new stub? Report
  those as new gaps.

Do not audit tests or lines the repair did not touch. If you notice a real problem outside
the repair, mention it in the summary as a note for the code reviewer; it never goes in
gaps[] and never costs another round.

Output: a short summary, then exactly one fenced JSON object, last in your message:
{"verdict": "PASS" | "FAIL", "criteria_map": [...], "gaps": [...], "gaming_flags": [...]}
PASS only when gaps[] and gaming_flags[] are both empty.

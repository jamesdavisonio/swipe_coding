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
   - weak-assertion — B5-22 Done > sorts this week by doneAt, newest first, whatever order the tasks arrive in — ids k-d1 < k-d2 < k-d3 (and default titles `Task <id>`) sort lexically into the expected doneAt-newest-first order, so sorting by id ascending (or title) passes without reading doneAt.
   - weak-assertion — B5-22 Done > sorts the older ones by doneAt, newest first, whatever order they arrive in — ids k-o1 < k-o2 < k-o3 likewise.
     gaming_flags:
   - B5-22 Done newest-first: sort the within-week tasks by id ascending (localeCompare).
   - B5-22 Show older: sort the older tasks by id ascending.
4. The repair (untracked file; the author's change list): only those two tests and the comment
   above them changed.
   - This week, received: w-a "Clean the logs" (doneAt −3d, updatedAt −2h), w-c "Bump the deps"
     (−2d, −2d), w-b "Add dark mode" (−4d, −3d); expects /t/w-c, /t/w-a, /t/w-b.
   - Older, received: o-a "Cache warmup" (−pastWeek(3), −2h), o-c "Backfill the index"
     (−pastWeek(1), −pastWeek(1)), o-b "Archive search" (−pastWeek(5), −pastWeek(5)); after
     Show 3 older expects /t/o-c, /t/o-a, /t/o-b.
   - The author reports that id asc/desc, title asc/desc, received order, its reverse and
     updatedAt both ways all differ from the expected order in both buckets.
   - TASKS, the boundary test and every other test are unchanged (they no longer carry the
     ordering proof; the earlier checker noted this as fine).
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

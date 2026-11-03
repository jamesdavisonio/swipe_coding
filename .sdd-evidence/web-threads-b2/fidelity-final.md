# web-threads B2 — fidelity gate

Round 1 (full audit, fresh context, claude-opus): FAIL — 5 gaps, 0 gaming flags; every
criterion 6–12, 29, 30 mapped to at least one non-tautological test. Gaps: (1) read-error
logging unstated in contract; (2) All chip count unasserted; (3) no check that a row without a
need has no quick replies; (4) B2-30 aria-pressed loop vacuous; (5) threadRows filter tested
on todo rows only. Planner decisions recorded in docs/features/web-threads.md ("Fidelity
round 1 decisions"). Author repaired exactly those five.

Round 2 (scoped delta check of the five repairs, same checker, per James's rule
"repair what was found, re-check only that"):

```json
{
  "verdict": "CLOSED",
  "gaps": [
    {
      "gap": 1,
      "status": "closed",
      "note": "Planner decision: data.ts read hooks log api_call_failed; Threads tests mock data.ts and make no logging assertion; B2-29 comment matches."
    },
    {
      "gap": 2,
      "status": "closed",
      "note": "B2-7 now asserts the All chip count of 5, which matches the board (k1, s1, s2, s3 + todo-k)."
    },
    {
      "gap": 3,
      "status": "closed",
      "note": "New B2-9 test: quiet pr-stage and spec-stage tasks with needs null give quickReplies() === []; a stage-keyed implementation fails it."
    },
    {
      "gap": 4,
      "status": "closed",
      "note": "B2-30 looks up All, kanban, website and calendar by name and checks aria-pressed is true or false, so it is no longer vacuous; chip is still imported for the keyboard filter test. Non-blocking: the start-of-name match could hit more than one button if a row's open button name starts with the project name."
    },
    {
      "gap": 5,
      "status": "closed",
      "note": "B2-8 threadRows call now includes p-kanban and p-site tasks and asserts sorted ids ['for_james:p-site', 'site-task'], so task-row filtering is checked; order is covered elsewhere."
    }
  ],
  "regressions": []
}
```

Non-blocking note on gap 4 resolved in the contract (commit acd6778): a row button's
accessible name starts with the task title.

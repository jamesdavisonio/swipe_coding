# web-threads B6 — fidelity gate (delta loop per skills ADR 0009)

Full audit (fresh context, claude-opus): FAIL — 5 gaps, 4 gaming flags; every criterion (25–27,
29 and 30 on the two sheets) mapped; red valid (45 component failures on missing controls; 15
emulator failures: reopenTask / useLogArchive missing; 7 legitimate passes at red). Planner
decision recorded before the audit (commit 0b21ea8): history times day first with an English
month in any locale.

Delta 1 (fresh): FAIL — 3 of 5 closed (navigation keeps state.from; archive success shows no
error; Cancel/Close focus return). Open 9 → 4.
Delta 2 (fresh): FAIL — stale-doneAt footer guard closed; `[]` locale bypass closed but
unsupported tags ('default', 'und') still escaped. Open 4 → 2.
Delta 3 (fresh): FAIL — unsupported-tag bypass closed; a module-scope formatter built before
the stubs still escaped. Open 2 → 1.
Delta 4 (fresh, automatic backstop): FAIL — module-scope formatter closed (fresh re-import after
stubbing) but the repair leaked vi.resetModules()/vi.doMock into later describes. Open 1 → 1.
Escalated to James with a round decision brief (escalation.md); James: "another round".
Delta 5 (fresh):

```json
{
  "verdict": "PASS",
  "criteria_map": [
    {
      "criterion": 25,
      "tests": [
        "B6-25 the History sheet > is a dialog named Decision history with the task title as its heading",
        "B6-25 the History sheet > lists the entries oldest first, each with who, time and text",
        "B6-25 the History sheet > names the author: You for James, Session for the session, Board for the system",
        "B6-25 the History sheet > stamps today, yesterday and older entries as the prototype does",
        "B6-25 the History sheet > says \"Nothing recorded yet.\" when the log is empty",
        "B6-25 the History sheet > does not say \"Nothing recorded yet.\" when there are entries",
        "B6-25 the History sheet > offers Reopen task on a done task",
        "B6-25 the History sheet > has no Reopen task on a task still in flight",
        "B6-25 opening the History sheet > opens from the thread's Decision history button, listing entries and never messages",
        "B6-25 opening the History sheet > logs nothing when it opens",
        "B6-25 opening the History sheet > opens from a done task's History button on the project's Done tab",
        "B6-25 earlier history from the archive > offers Show earlier history only when the log is at LOG_CAP",
        "B6-25 earlier history from the archive > offers Show earlier history on a full log",
        "B6-25 earlier history from the archive > lists the archived entries above the rest once asked, not before",
        "B6-25 stamps in another time zone and locale > still stamps \"Today HH:MM\", \"Yesterday HH:MM\" and \"<day> <Mon> HH:MM\" in local time"
      ],
      "status": "unchanged by repair; module-reset leak closed (lazy-import + log-on-mount probe now fails 'logs nothing when it opens')"
    }
  ],
  "gaps": [],
  "gaming_flags": []
}
```

Notes for the code reviewer from the delta checks: a deliberate globalThis-cached formatter would
still pass the foreign-locale test (unavoidable without process isolation); a save that
navigates to the same thread with location.state pushes a duplicate history entry.

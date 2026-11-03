# web-threads B4 — fidelity gate

Round 1 (full audit, fresh context, claude-opus): FAIL — 5 gaps, 2 gaming flags; every
criterion (16–20, 28 tick half, 29 write-failure state, 30 on the sheet, and the carried-over
sendReply/markRead emulator tests) mapped to non-tautological tests; red evidence valid
(72/72 component failures, 35 emulator failures on missing behaviour; the 45 emulator passes
are the B1 rules suite plus pre-existing sendReply, markRead and transaction guards). Gaming
flags: (1) milestone logged at tap time, before or regardless of the write; (2) an
uncontrolled checkbox ignoring later snapshots. Gaps: milestone timing; logger method
unpinned; checkbox not driven by later snapshots; free-text Send answer not tested disabled
while pending; full question tested only with a short question. Planner decision recorded in
docs/features/web-threads.md ("Fidelity round 1 decisions (B4)", commit 93e6d52).

Round 2 (scoped delta of the repairs, same checker):

```json
{
  "verdict": "CLOSED",
  "gaps": [
    {
      "gap": 1,
      "status": "closed",
      "note": "b4-19 'logs no milestone while the completing tick is still pending' and 'logs no milestone when the completing tick fails' pin milestone_reached to after the write resolves."
    },
    {
      "gap": 2,
      "status": "closed",
      "note": "Spec 'Fidelity round 1 decisions (B4)' pins log.event('milestone_reached', { feature, milestone: 'task_done', target }); reading from logSpy.event is now grounded."
    },
    {
      "gap": 3,
      "status": "closed",
      "note": "b4-19 'follows afterDone from later snapshots without a tap' rerenders [false,false]→[true,false]→[false,false] and asserts each state with tickStep never called."
    },
    {
      "gap": 4,
      "status": "closed",
      "note": "b4-17 'disables Send answer while typed text is being saved' asserts disabled, one answerQuestion call and no onClose under a pending write."
    },
    {
      "gap": 5,
      "status": "closed",
      "note": "b4-17 'is named by the whole of a long question' uses a 200+ character question and requires the dialog name to equal it exactly."
    },
    {
      "gap": "flag-1",
      "status": "closed",
      "note": "Logging the milestone at tap time now fails the pending and denied tests."
    },
    {
      "gap": "flag-2",
      "status": "closed",
      "note": "An uncontrolled defaultChecked checkbox now fails the later-snapshot test; the controlled checkbox is pinned in the spec."
    }
  ],
  "regressions": []
}
```

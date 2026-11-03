# web-threads B3 — fidelity gate

Round 1 (full audit, fresh context, claude-opus): FAIL — 7 gaps, 2 gaming flags; every
criterion (13, 14, 15, 2 opened-by-id, 28 reply half, 29, 30 on the thread view) mapped to
non-tautological tests. Gaming flags: (1) one comment id reused for every send passes;
(2) de-duplicating the optimistic message by text passes. Gaps: two-send case missing;
fresh-id assertion over-constrained; James meta position unstated; no check that James's
messages carry no kind label; system-line label before the body unchecked; no empty-thread
copy; projects/agents read failures untested. Planner decisions recorded in
docs/features/web-threads.md ("Fidelity round 1 decisions (B3)", commit d4694a2).

Round 2 (scoped delta of the repairs, same checker): OPEN — gaps 1–7 and flag 1 closed;
flag 2 still open (the echo delivered both ids at once) and one regression (KIND_LABEL span
included the stepper).

Round 3 (scoped delta of those two items, same checker):

```json
{
  "verdict": "CLOSED",
  "gaps": [
    {
      "gap": "flag-2",
      "status": "closed",
      "note": "A partial echo (first id only, second write pending) now requires two 'ok' on screen, so text-matching de-duplication shows one and fails."
    },
    {
      "gap": "stepper-regression",
      "status": "closed",
      "note": "conversationAfter skips the Stages list's text, so the gap-4 and gap-5 KIND_LABEL checks no longer depend on how the stepper separates its items; the assertions are otherwise unchanged."
    }
  ],
  "regressions": []
}
```

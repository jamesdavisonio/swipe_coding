# Fidelity gate — round 6 (FAIL: 2 gaps, 1 gaming flag; everything else holds)

Checker: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context); rounds 1–5 withheld. Re-ran unit (35/5) and rules (9/21), matching the
saved captures; tsc only TS2305; agent red run accepted from `red-agent-run.txt`. Hygiene clean.
Coverage of criteria 1–4 and every contract item judged strong.

Gaps (checker's words, abridged):

1. missing-edge-case · rules test, other-principals loop · comment READS by stranger / unverified /
   anonymous are never asserted; loosening the separate comments read rule to
   `request.auth != null` would pass. Fix: `assertFails(getDoc(doc(db(), 'comments/j1')))` in the loop.
2. weak-assertion + gaming flag · contract `initialTaskFields` · `createdBy` is only ever `'james'`,
   so a stub hardcoding it passes. Fix: a `createdBy: 'agent'` case.

Not counted: omission of own-comment edit/delete is correct (out of scope); the extra protocol
steps are in the spec's agent-compat list; a planner hole — kind restricted on create only, so a
browser update could rewrite a James comment into a session kind.

Orchestrator action: both gaps to the author; the planner hole closed by adding to the spec's "B1
contract details": a browser `update` of a comment may not change `author` or `kind`, with one
emulator test. Verdict JSON (verbatim):

```json
{
  "verdict": "FAIL",
  "gaps": [
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::<stranger|unverified James|anonymous>: refused on tasks, comments, todos, projects and agents",
      "issue": "Other principals are never asserted refused on reading comments (comments/j1 is seeded but only update/delete are checked), so loosening the separate comments read rule to `if request.auth != null` while editing that block for the kind restriction passes every test, and the static guard only blocks a literal `if true`.",
      "fix": "Add `await assertFails(getDoc(doc(db(), 'comments/j1')))` to the other-principals loop."
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-contract.test.ts::a new feature task is exactly the contract shape: stage spec, every new field empty",
      "issue": "Every initialTaskFields call passes createdBy 'james', so an implementation that hardcodes createdBy: 'james' (wrong for agent-created tasks) passes.",
      "fix": "Add a case with createdBy: 'agent' and assert the returned createdBy is 'agent'."
    }
  ],
  "gaming_flags": [
    {
      "where": "tests/web-threads-b1-contract.test.ts::a new feature task is exactly the contract shape: stage spec, every new field empty",
      "stub_that_passes": "initialTaskFields returns { ...correct fields, createdBy: 'james' } ignoring input.createdBy"
    }
  ]
}
```

(The checker's `criteria_map` is identical in substance to round 5's and is omitted here; the
round-5 file holds it.)

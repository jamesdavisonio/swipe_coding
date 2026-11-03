# Fidelity gate — round 7 (FAIL: 2 gaps, 2 gaming flags; coverage "close to complete")

Checker: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context); rounds 1–6 withheld. Re-ran unit (36/5) and rules (10/22); tsc only TS2305;
the three red captures fail for the right reasons. Every criterion and contract item mapped,
including the new "update may not change author or kind" line. Hygiene clean.

Gaps (checker's words, abridged):

1. missing-edge-case · rules test "James cannot change a sent comment's kind" · only comment → spec
   is tried; a rule reusing the create check (`kind in [six James kinds]`) passes while still
   allowing comment → approve. Fix: assertFails on updateDoc({ kind: 'approve' }).
2. weak-assertion · protocol.ts "update_task done" · `stage: 'done'` asserted only on the returned
   brief; the Firestore read-back checks agentId, doneAt, pr.url but not stage. Fix: add
   `snap.get('stage') === 'done'` to the read-back assertion.

Minor, not counted: the static default-deny guard compares normalised text exactly.

Orchestrator action: both one-line additions sent to the author (round 7 fixes). Convergence
decision put to the human: accept the tests as the frozen contract once these two land, or run
an eighth checker round.

Verbatim gaps/gaming_flags JSON:

```json
{
  "verdict": "FAIL",
  "gaps": [
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::James cannot change a sent comment's kind",
      "issue": "The contract says a browser update of a comment may not change its kind, but the only kind-change case rewrites a James kind into a session kind (comment → spec), so a change between two James kinds (comment → approve) is never tested.",
      "fix": "Add a case that seeds a James 'comment' and asserts assertFails on updateDoc({ kind: 'approve' }), so the rule must compare request.resource.data.kind to resource.data.kind."
    },
    {
      "type": "weak-assertion",
      "where": "packages/agent/test/protocol.ts::update_task done moves stage to done",
      "issue": "stage 'done' is asserted only on the returned brief; the Firestore read-back checks agentId, doneAt and pr.url but not the stored stage, which is what the web reads.",
      "fix": "Add snap.get('stage') === 'done' to the 'done task is unbound, doneAt stamped, pr recorded' Firestore assertion."
    }
  ],
  "gaming_flags": [
    {
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::James cannot change a sent comment's kind",
      "stub_that_passes": "allow update, delete: if isOwner() && resource.data.author == 'james' && authoredByJames() && request.resource.data.kind in ['comment','answer','approve','change_request','merged','reopen']; (reuses the create kind check, so comment → approve is still allowed)"
    },
    {
      "where": "packages/agent/test/protocol.ts::update_task done moves stage to done",
      "stub_that_passes": "updateTask writes { agentId: null, doneAt, pr } to Firestore but returns { ...task, ...patch, stage: 'done' } without writing stage to the document"
    }
  ]
}
```

(The checker's full `criteria_map` is in the agent transcript; it extends round 5's map with the
new contract line and the agent-compat items.)

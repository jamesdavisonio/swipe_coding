# Fidelity gate — round 8 (FAIL: 5 gaps, 3 gaming flags; coverage "complete")

Checker: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context); rounds 1–7 withheld. Run by the human's choice after round 7 (option 2).
Re-ran unit (36/5) and rules (11/22); tsc only TS2305; all three captures fail for missing
behaviour. Coverage of every criterion, packet edge case and "fixed at test time" contract line
judged complete; no out-of-scope tests; hygiene otherwise clean.

Gaps (checker's words, abridged):

1. weak-assertion · contract `initialTaskFields` · every case uses the same projectId/title/
   description/now, so a stub hardcoding them passes. Fix: one case with different inputs echoed.
2. weak-assertion · contract `stageIndex` · only 6, 6 and -1 expected; `includes ? 6 : -1` passes.
   Fix: assert 0, a middle position, and 7 with after-deploy steps.
3. weak-assertion · protocol.ts `subtask spec done → approved` · only key 'spec' is exercised; a
   single special case passes. Fix: a second key in the same live sequence.
4. missing-edge-case · rules test · James is never shown reading a comment, todo or project; a
   comments-block rewrite that drops the owner's read passes. Fix: assertSucceeds on getDoc.
5. hygiene · static text guards · duplicate the emulator test and the rules-lint script; the
   default-deny guard is wording-dependent despite the header. Fix: drop or loosen them.

Verbatim gaps/gaming_flags JSON:

```json
{
  "verdict": "FAIL",
  "gaps": [
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-contract.test.ts::initialTaskFields > a new feature task is exactly the contract shape: stage spec, every new field empty",
      "issue": "projectId 'p1', title 'T', description 'D' and now 1_800_000_000_000 are identical in every initialTaskFields case, so an implementation that hardcodes them instead of echoing the input passes.",
      "fix": "Add a case with different projectId, title, description and now (e.g. 'p2', 'Other', 'Desc 2', 1_700_000_000_123) and assert they are echoed into projectId/title/description/createdAt/updatedAt."
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-contract.test.ts::isQueued > stageIndex follows the stage list and is -1 for a stage not in it",
      "issue": "The only expected values are 6, 6 and -1, so a stub returning a constant 6 for any in-list stage passes and the position is never actually checked.",
      "fix": "Also assert first stage → 0, a middle stage (e.g. feature 'pr' → 3, bugfix 'merged' → 2) and done with after-deploy steps → 7."
    },
    {
      "type": "weak-assertion",
      "where": "packages/agent/test/protocol.ts::subtask spec done → stage <stage>",
      "issue": "The contract says status 'done' on a key advances stage past that key, but only key 'spec' → 'approved' is exercised, so a single special case satisfies it.",
      "fix": "Add a second key in the same live sequence (e.g. kanban_subtask key 'approved' or 'build' status 'done' → next stage) before update_task done."
    },
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::comment kinds",
      "issue": "B1 rewrites the comments rules block, but no test shows that James can still read a comment (or read back a todo or project), so a rewrite that drops the owner's read passes every case.",
      "fix": "Add assertSucceeds(getDoc(...)) for James on a seeded comment (both authors), a todo and a project."
    },
    {
      "type": "hygiene",
      "where": "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules minimal text guards > a default-deny block exists",
      "issue": "The three rules-text guards check the file's text rather than behaviour, duplicate the emulator test and scripts/check-firestore-rules.mjs, and the default-deny guard requires the exact single string 'allow read, write: if false;', contrary to the header's claim that the guards don't depend on wording.",
      "fix": "Drop the text guards, relying on the emulator default-deny/agents tests and the rules-lint script, or loosen default-deny to 'every allow in the block ends in if false'."
    }
  ],
  "gaming_flags": [
    {
      "where": "tests/web-threads-b1-contract.test.ts::initialTaskFields > a new feature task is exactly the contract shape: stage spec, every new field empty",
      "stub_that_passes": "return { projectId: 'p1', title: 'T', description: 'D', createdAt: 1_800_000_000_000, updatedAt: 1_800_000_000_000, type: input.type, createdBy: input.createdBy, afterDeploy: input.afterDeploy, afterDone: input.afterDeploy.map(() => false), stage: stagesFor(input.type, input.afterDeploy.length > 0)[0], ...nullDefaults }"
    },
    {
      "where": "tests/web-threads-b1-contract.test.ts::isQueued > stageIndex follows the stage list and is -1 for a stage not in it",
      "stub_that_passes": "stageIndex = (t) => stagesFor(t.type, t.afterDeploy.length > 0).includes(t.stage) ? 6 : -1"
    },
    {
      "where": "packages/agent/test/protocol.ts::subtask spec done → stage <stage>",
      "stub_that_passes": "in setSubtask: if (key === 'spec' && status === 'done') patch.stage = 'approved' (no general key → next-stage mapping)"
    }
  ]
}
```

(The checker's full `criteria_map` is in the agent transcript; it matches round 7's with the
added kind-change and stored-stage tests.)

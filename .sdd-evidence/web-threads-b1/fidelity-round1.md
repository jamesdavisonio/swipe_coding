# Fidelity gate — round 1 (FAIL)

Checker: fresh Claude subagent, role `verify`, binding anthropic/claude-opus-5-5, profile
anthropic-only (isolation: context). Inputs: prompt-fidelity.md, spec B1, the five test files,
the protocol.ts diff, taxonomy, packet-test-author.md. No implementation existed.

Verdict JSON (verbatim):

```json
{
  "verdict": "FAIL",
  "gaps": [
    {
      "type": "uncovered-criterion",
      "where": "criterion 2 'opened by id'",
      "issue": "no test anywhere and not handed to a later behaviour",
      "fix": "assign to B3 thread-view tests"
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules",
      "issue": "regex over rules text; an extra permissive match block passes",
      "fix": "assert every allow is false or starts with isOwner()"
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-4.test.ts::the archived task log is owner-only",
      "issue": "matches a top-level /log_archive too",
      "fix": "require nesting under /tasks/{id}"
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-4.test.ts::owner reads and writes…",
      "issue": "word ban on status/subtasks/openQuestion hits comments",
      "fix": "drop the word ban"
    },
    {
      "type": "missing-edge-case",
      "where": "tests/web-threads-b1-4.test.ts::B1-4 firestore.indexes.json",
      "issue": "comments indexes unasserted",
      "fix": "assert both comments composites present"
    },
    {
      "type": "hygiene",
      "where": "tests/web-threads-b1-4.test.ts::has the stage and doneAt task indexes",
      "issue": "pins (projectId, doneAt desc) while spec said (doneAt)",
      "fix": "reconcile in spec/ADR"
    },
    {
      "type": "missing-edge-case",
      "where": "criterion 3",
      "issue": "no case with absent workingAt/handledAt fields",
      "fix": "add missing-field cases"
    },
    {
      "type": "missing-edge-case",
      "where": "tests/web-threads-b1-contract.test.ts::isQueued",
      "issue": "no wrong-type / for_james negative",
      "fix": "add negatives"
    },
    {
      "type": "missing-edge-case",
      "where": "tests/web-threads-b1-1.test.ts::chore is do → done",
      "issue": "stagesFor('chore', true) unpinned",
      "fix": "planner decides and adds assertion"
    },
    {
      "type": "out-of-scope-test",
      "where": "tests/web-threads-b1-1.test.ts::every stage has the label James sees",
      "issue": "STAGE_LABEL not in spec contract",
      "fix": "add to contract or move to B3"
    },
    {
      "type": "out-of-scope-test",
      "where": "packages/agent/test/protocol.ts::subtask spec awaiting_approval → needs spec",
      "issue": "new assertion encodes compat behaviour not in spec",
      "fix": "record mapping in spec/ADR or drop"
    },
    {
      "type": "hygiene",
      "where": "packages/agent/test/protocol.ts poll loops",
      "issue": "pre-existing 100 ms poll loops",
      "fix": "onSnapshot wait helper or explicit waiver"
    }
  ],
  "gaming_flags": [
    {
      "where": "tests/web-threads-b1-4.test.ts::anything else is refused by the default deny",
      "stub_that_passes": "add `match /{path=**} { allow read, write: if request.auth != null; }`"
    },
    {
      "where": "tests/web-threads-b1-4.test.ts::the archived task log is owner-only",
      "stub_that_passes": "top-level `match /log_archive/{entry}`"
    },
    {
      "where": "tests/web-threads-b1-contract.test.ts::first stage and no agent → queued, for each type",
      "stub_that_passes": "isQueued ignoring type: ['spec','fix','do'].includes(stage) && agentId == null"
    }
  ]
}
```

(The checker's full criteria_map is in its transcript; every criterion 1–4 and every contract
item mapped to at least one non-tautological test; the four already-green regression guards
in -4 were judged acceptable but not red evidence.)

Planner decisions taken in response (recorded in docs/features/web-threads.md, "B1 contract
details fixed at test time"): chore + after-deploy = do → after_deploy → done; STAGE_LABEL in
contract; deliveryState treats missing stamp fields as null; indexes = tasks(projectId, stage,
updatedAt desc) + tasks(projectId, doneAt desc), comments composites unchanged; subtask→needs
compat mapping stated; "opened by id" assigned to B3.

## Waiver

`packages/agent/test/protocol.ts` keeps its pre-existing 100 ms poll loops (lines ~228, ~263)
against real Firestore. They predate this spec, the file is the agent's stdio integration test
(not a vitest file), and replacing them with an onSnapshot helper is agent-side work for
DESIGN.md Phase 2 package 2. The test author was told not to touch them.

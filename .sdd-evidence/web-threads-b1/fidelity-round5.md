# Fidelity gate — round 5 (FAIL: 3 gaps, 0 gaming flags)

Checker: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context); rounds 1–4 withheld. The checker re-ran both suites: unit 35 failed / 5
passed, rules 9 failed / 21 passed, every failure for missing behaviour; `packages/agent`
typecheck passes. Criteria 1–4 and every named edge case mapped; stub resistance judged good.

Checker's summary of the gaps (its words, abridged):

1. Live red evidence for the edited `protocol.ts` assertions is missing. The file has a
   `FIRESTORE_EMULATOR_HOST` mode honoured by `src/firestore.ts`, so
   `firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"` gives red
   evidence without touching the real board.
2. Non-owner principals are never tried on delete (task, todo, project) nor on update/delete of a
   James comment, so a comments rule rewritten without `isOwner()` on update/delete would pass.
3. `initialTaskFields` is checked with `toEqual`, which ignores undefined-valued retired keys.

Observations the checker did not count: the contract restricts kinds on comment create only (an
update could rewrite a kind) — a planner question, not a test defect; the two new call sequences
in `protocol.ts` go beyond "edit only the assertions" but are in the spec's agent-compat contract.

Orchestrator action: all three gaps plus three `TS2352` cast errors (compat `Firestore` → modular
`Firestore` needs `as unknown as`) sent to the test author as one revision; emulator-mode agent run
replaces the live-board run, so no human waiver is needed.

Verbatim verdict JSON:

```json
{
  "verdict": "FAIL",
  "criteria_map": [
    {
      "criterion": "Given a task of type `feature` without after-deploy steps, when its stage list is derived, the list is `spec → approved → build → pr → merged → main_ci → done`; with after-deploy steps `after_deploy` sits before `done`; `bugfix` starts at `fix` instead of `spec → approved → build`; `chore` is `do → done`.",
      "tests": [
        "tests/web-threads-b1-1.test.ts::B1-1 stage list per task type > feature without after-deploy steps: spec → approved → build → pr → merged → main_ci → done",
        "tests/web-threads-b1-1.test.ts::B1-1 stage list per task type > feature with after-deploy steps puts after_deploy right before done",
        "tests/web-threads-b1-1.test.ts::B1-1 stage list per task type > bugfix starts at fix instead of spec → approved → build",
        "tests/web-threads-b1-1.test.ts::B1-1 stage list per task type > chore is do → done, with after_deploy before done when it has steps",
        "tests/web-threads-b1-1.test.ts::B1-1 stage list per task type > for_james has an empty stage list",
        "tests/web-threads-b1-1.test.ts::B1-1 stage list per task type > every stage has the label James sees"
      ]
    },
    {
      "criterion": "Given a done task with `doneAt` more than 7 days ago, when any list is computed with \"show older\" off, the task is excluded; with \"show older\" on, or when opened by id, it is shown.",
      "tests": [
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > the window is 7 days",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > only the done stage counts as done",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > a done task finished more than 7 days ago is excluded with show older off",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > show older on brings it back",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > doneAt exactly 7 days ago is still visible",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > a not-done task is visible whatever its doneAt; a done task without doneAt is visible",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > defaults to the current time when now is not given",
        "tests/web-threads-b1-2.test.ts::B1-2 done-task visibility > filtering a list keeps everything except done tasks older than 7 days",
        "(\"opened by id\" clause assigned to B3 by the spec's B1 contract details; not in B1 scope)"
      ]
    },
    {
      "criterion": "Given James's comment, when it is created, its delivery state is `sent`; when the agent stamps `deliveredAt` it reads `delivered`; when `workingAt` is set `working`; when `handledAt` is set `handled` — and the derivation never goes backwards.",
      "tests": [
        "tests/web-threads-b1-3.test.ts::B1-3 comment delivery state > a just-created comment is sent",
        "tests/web-threads-b1-3.test.ts::B1-3 comment delivery state > deliveredAt stamped → delivered",
        "tests/web-threads-b1-3.test.ts::B1-3 comment delivery state > workingAt set → working",
        "tests/web-threads-b1-3.test.ts::B1-3 comment delivery state > handledAt set → handled",
        "tests/web-threads-b1-3.test.ts::B1-3 comment delivery state > never goes backwards when an earlier stamp is missing",
        "tests/web-threads-b1-3.test.ts::B1-3 comment delivery state > absent workingAt/handledAt fields read like null"
      ]
    },
    {
      "criterion": "Given the Firestore rules, when James's signed-in browser writes the new fields (`stage`, `needs`, `afterDone`, `log`, `doneAt`, `reopenedAt`, comment kinds, todos), the write succeeds; when any other principal tries, it is refused; `agents` stays read-only from the browser.",
      "tests": [
        "tests/rules/web-threads-b1-4.rules.test.ts::owner writes the new task fields, todos and projects > j@nullnoise.ai creates a task with the new fields and reads it back",
        "tests/rules/web-threads-b1-4.rules.test.ts::owner writes the new task fields, todos and projects > james@nullnoise.ai creates a task with the new fields and reads it back",
        "tests/rules/web-threads-b1-4.rules.test.ts::owner writes the new task fields, todos and projects > updates stage, needs, afterDone, log, doneAt and reopenedAt on an existing task",
        "tests/rules/web-threads-b1-4.rules.test.ts::owner writes the new task fields, todos and projects > creates, updates and deletes a todo",
        "tests/rules/web-threads-b1-4.rules.test.ts::owner writes the new task fields, todos and projects > creates a project",
        "tests/rules/web-threads-b1-4.rules.test.ts::comment kinds > James sends a \"<kind>\" comment (x6)",
        "tests/rules/web-threads-b1-4.rules.test.ts::comment kinds > James cannot send a \"<kind>\" comment (not a James kind) (x8)",
        "tests/rules/web-threads-b1-4.rules.test.ts::comment kinds > a comment authored as the agent is refused whatever the kind",
        "tests/rules/web-threads-b1-4.rules.test.ts::comment kinds > James cannot edit the agent's comment",
        "tests/rules/web-threads-b1-4.rules.test.ts::archived task log > James writes and reads an archive entry under its task",
        "tests/rules/web-threads-b1-4.rules.test.ts::archived task log > <who> can neither read nor write it (x3)",
        "tests/rules/web-threads-b1-4.rules.test.ts::any other principal is refused > <who>: refused on tasks, comments, todos, projects and agents (x3)",
        "tests/rules/web-threads-b1-4.rules.test.ts::agents stay read-only from the browser > James reads an agent but cannot create, update or delete one",
        "tests/rules/web-threads-b1-4.rules.test.ts::default deny > James is refused on a collection the rules do not name",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules minimal text guards > no allow is unconditional or `if true`",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules minimal text guards > a default-deny block exists",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules minimal text guards > agents grant no write from the browser"
      ]
    },
    {
      "criterion": "Selected new contract (B1): appendLog cap 200 / overflow archive oldest-first / input not mutated",
      "tests": [
        "tests/web-threads-b1-contract.test.ts::appendLog > caps the history at 200 entries",
        "tests/web-threads-b1-contract.test.ts::appendLog > under the cap appends in order and archives nothing, leaving the input untouched",
        "tests/web-threads-b1-contract.test.ts::appendLog > reaching exactly 200 archives nothing",
        "tests/web-threads-b1-contract.test.ts::appendLog > a 201st entry archives exactly the oldest one, leaving the input untouched",
        "tests/web-threads-b1-contract.test.ts::appendLog > an oversized log returns all the overflow, oldest first, keeping the newest 200 in order"
      ]
    },
    {
      "criterion": "Selected new contract (B1): isQueued = first stage && agentId == null; stageIndex -1 when not in list",
      "tests": [
        "tests/web-threads-b1-contract.test.ts::isQueued > first stage and no agent → queued, for each type",
        "tests/web-threads-b1-contract.test.ts::isQueued > binding an agent un-queues it",
        "tests/web-threads-b1-contract.test.ts::isQueued > advancing the stage un-queues it",
        "tests/web-threads-b1-contract.test.ts::isQueued > another type's first stage is not queued; for_james is never queued",
        "tests/web-threads-b1-contract.test.ts::isQueued > stageIndex follows the stage list and is -1 for a stage not in it"
      ]
    },
    {
      "criterion": "Selected new contract (B1): initialTaskFields shape; JAMES_COMMENT_KINDS",
      "tests": [
        "tests/web-threads-b1-contract.test.ts::initialTaskFields > a new feature task is exactly the contract shape: stage spec, every new field empty",
        "tests/web-threads-b1-contract.test.ts::initialTaskFields > starts bugfix at fix and chore at do, with no after-deploy flags",
        "tests/web-threads-b1-contract.test.ts::James comment kinds are exactly the six he can send"
      ]
    },
    {
      "criterion": "Selected new contract (B1): indexes tasks(projectId, stage, updatedAt desc), tasks(projectId, doneAt desc), comments unchanged, status indexes gone",
      "tests": [
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.indexes.json > has the stage and doneAt task indexes",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.indexes.json > keeps both comments indexes unchanged",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.indexes.json > no longer indexes status"
      ]
    },
    {
      "criterion": "Selected new contract (B1): agent compat (create brief stage/needs/mine, subtask spec awaiting_approval → needs spec, done → next stage, ask → needs question, answer → needs null, update_task in_progress → needs null, done → stage done/doneAt/agentId null/pr.url)",
      "tests": [
        "packages/agent/test/protocol.ts::create_task → <id>",
        "packages/agent/test/protocol.ts::subtask spec awaiting_approval → needs spec",
        "packages/agent/test/protocol.ts::ask → needs question",
        "packages/agent/test/protocol.ts::answer → needs cleared",
        "packages/agent/test/protocol.ts::subtask spec done → stage <stage>",
        "packages/agent/test/protocol.ts::update_task in_progress after ask → needs null",
        "packages/agent/test/protocol.ts::update_task done moves stage to done",
        "packages/agent/test/protocol.ts::done task is unbound, doneAt stamped, pr recorded"
      ]
    }
  ],
  "gaps": [
    {
      "type": "hygiene",
      "where": "packages/agent/test/protocol.ts (live red evidence)",
      "issue": "The edited live-path assertions have no recorded red run, so it is unproven that they fail for missing behaviour rather than for a harness or fixture problem.",
      "fix": "Run the board path and record its tail, either live with KANBAN_TEST_LIVE=1 or safely via the file's existing FIRESTORE_EMULATOR_HOST mode (`firebase emulators:exec --only firestore --project demo-kanban \"npm run test:agent\"` with the JDK on PATH), or get the human's written waiver."
    },
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::any other principal is refused > <who>: refused on tasks, comments, todos, projects and agents",
      "issue": "Other principals are tested only on get, create and update: nothing covers them deleting a task, todo or project, or updating or deleting one of James's comments, so a comments rule rewritten by B1 without isOwner() on update/delete would pass every test.",
      "fix": "Add assertFails for deleteDoc on tasks/t1, todos/x1 and projects/p1, plus updateDoc and deleteDoc on a seeded author:'james' comment, for each non-owner principal."
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-contract.test.ts::initialTaskFields > a new feature task is exactly the contract shape: stage spec, every new field empty",
      "issue": "toEqual ignores undefined-valued properties, so a result that still carries retired keys (status, subtasks, openQuestion, prUrl, branch) set to undefined passes, although the contract says initialTaskFields returns no retired keys.",
      "fix": "Use toStrictEqual, or also assert Object.keys(t).sort() equals the exact contract key list."
    }
  ],
  "gaming_flags": []
}
```

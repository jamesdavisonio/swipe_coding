# Fidelity gate — round 4 (FAIL) → one revision round after the human's escalation choice

Checker: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context); rounds 1–3 withheld. Inputs: spec B1, tests b1-1..4 + contract + protocol.ts
diff + the new emulator test `tests/rules/web-threads-b1-4.rules.test.ts`, taxonomy, both author
packets, red-run outputs (checker re-ran both suites: unit 37/7, rules 3/20 — counts match).

Context: round 3 escalated to the human because criterion 4 was being tested statically. The
human chose to install Java so the criterion is tested in the emulator. This round audits that
result. Criteria 1–3 and the contract helpers are covered well with no gaming stub found; the
FAIL is confined to criterion 4's two files and a few narrow gaps.

Checker's scope ruling (asked explicitly): "James deletes his own comment" and "James edits his
own comment" are out of scope — the spec's Out of scope list excludes "Editing or deleting sent
messages". The delete test was one of the three red results and would force a rules change the
spec never asked for. Decision taken by the orchestrator: drop both tests; the dead
`update, delete` clause in today's rules (always refuses deletes because `request.resource` is
null on delete) is logged as a separate follow-up, not B1 work.

Verbatim verdict JSON:

```json
{
  "verdict": "FAIL",
  "criteria_map": [
    {
      "criterion": "Given a task of type `feature` without after-deploy steps, when its stage list is derived, the list is `spec → approved → build → pr → merged → main_ci → done`; with after-deploy steps `after_deploy` sits before `done`; `bugfix` starts at `fix` instead of `spec → approved → build`; `chore` is `do → done`.",
      "tests": [
        "tests/web-threads-b1-1.test.ts::feature without after-deploy steps: spec → approved → build → pr → merged → main_ci → done",
        "tests/web-threads-b1-1.test.ts::feature with after-deploy steps puts after_deploy right before done",
        "tests/web-threads-b1-1.test.ts::bugfix starts at fix instead of spec → approved → build",
        "tests/web-threads-b1-1.test.ts::chore is do → done, with after_deploy before done when it has steps",
        "tests/web-threads-b1-1.test.ts::for_james has an empty stage list",
        "tests/web-threads-b1-1.test.ts::every stage has the label James sees"
      ]
    },
    {
      "criterion": "Given a done task with `doneAt` more than 7 days ago, when any list is computed with \"show older\" off, the task is excluded; with \"show older\" on, or when opened by id, it is shown.",
      "tests": [
        "tests/web-threads-b1-2.test.ts::the window is 7 days",
        "tests/web-threads-b1-2.test.ts::only the done stage counts as done",
        "tests/web-threads-b1-2.test.ts::a done task finished more than 7 days ago is excluded with show older off",
        "tests/web-threads-b1-2.test.ts::show older on brings it back",
        "tests/web-threads-b1-2.test.ts::doneAt exactly 7 days ago is still visible",
        "tests/web-threads-b1-2.test.ts::a not-done task is visible whatever its doneAt; a done task without doneAt is visible",
        "tests/web-threads-b1-2.test.ts::defaults to the current time when now is not given",
        "tests/web-threads-b1-2.test.ts::filtering a list keeps everything except done tasks older than 7 days"
      ]
    },
    {
      "criterion": "Given James's comment, when it is created, its delivery state is `sent`; when the agent stamps `deliveredAt` it reads `delivered`; when `workingAt` is set `working`; when `handledAt` is set `handled` — and the derivation never goes backwards.",
      "tests": [
        "tests/web-threads-b1-3.test.ts::a just-created comment is sent",
        "tests/web-threads-b1-3.test.ts::deliveredAt stamped → delivered",
        "tests/web-threads-b1-3.test.ts::workingAt set → working",
        "tests/web-threads-b1-3.test.ts::handledAt set → handled",
        "tests/web-threads-b1-3.test.ts::never goes backwards when an earlier stamp is missing",
        "tests/web-threads-b1-3.test.ts::absent workingAt/handledAt fields read like null"
      ]
    },
    {
      "criterion": "Given the Firestore rules, when James's signed-in browser writes the new fields (`stage`, `needs`, `afterDone`, `log`, `doneAt`, `reopenedAt`, comment kinds, todos), the write succeeds; when any other principal tries, it is refused; `agents` stays read-only from the browser.",
      "tests": [
        "tests/rules/web-threads-b1-4.rules.test.ts::j@nullnoise.ai creates a task with the new fields and reads it back",
        "tests/rules/web-threads-b1-4.rules.test.ts::james@nullnoise.ai creates a task with the new fields and reads it back",
        "tests/rules/web-threads-b1-4.rules.test.ts::updates stage, needs, afterDone, log, doneAt and reopenedAt on an existing task",
        "tests/rules/web-threads-b1-4.rules.test.ts::creates, updates and deletes a todo",
        "tests/rules/web-threads-b1-4.rules.test.ts::creates a project",
        "tests/rules/web-threads-b1-4.rules.test.ts::James sends a \"<kind>\" comment (x6)",
        "tests/rules/web-threads-b1-4.rules.test.ts::James cannot send a session kind (\"spec\")",
        "tests/rules/web-threads-b1-4.rules.test.ts::a comment authored as the agent is refused whatever the kind",
        "tests/rules/web-threads-b1-4.rules.test.ts::James writes and reads an archive entry under its task",
        "tests/rules/web-threads-b1-4.rules.test.ts::a stranger cannot read it",
        "tests/rules/web-threads-b1-4.rules.test.ts::<stranger|unverified James|anonymous>: task read/write, comment create, todo/project/agent reads",
        "tests/rules/web-threads-b1-4.rules.test.ts::James reads an agent but cannot create, update or delete one",
        "tests/rules/web-threads-b1-4.rules.test.ts::James is refused on a collection the rules do not name",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules (7 static guards)",
        "tests/web-threads-b1-4.test.ts::B1-4 firestore.indexes.json (3 tests)"
      ]
    },
    {
      "criterion": "Selected new contract (B1): appendLog cap/archive, isQueued, stageIndex, initialTaskFields, JAMES_COMMENT_KINDS, indexes, agent compat",
      "tests": [
        "tests/web-threads-b1-contract.test.ts::appendLog (5 tests)",
        "tests/web-threads-b1-contract.test.ts::isQueued (5 tests incl. stageIndex)",
        "tests/web-threads-b1-contract.test.ts::initialTaskFields (2 tests)",
        "tests/web-threads-b1-contract.test.ts::James comment kinds are exactly the six he can send",
        "tests/web-threads-b1-4.test.ts::has the stage and doneAt task indexes",
        "tests/web-threads-b1-4.test.ts::keeps both comments indexes unchanged",
        "tests/web-threads-b1-4.test.ts::no longer indexes status",
        "packages/agent/test/protocol.ts::create_task → id (stage spec, needs null, mine true)",
        "packages/agent/test/protocol.ts::subtask spec awaiting_approval → needs spec",
        "packages/agent/test/protocol.ts::ask → needs question",
        "packages/agent/test/protocol.ts::answer → needs cleared",
        "packages/agent/test/protocol.ts::update_task done moves stage to done / done task is unbound, doneAt stamped, pr recorded"
      ]
    }
  ],
  "gaps": [
    {
      "type": "hygiene",
      "where": "tests/web-threads-b1-4.test.ts::James's comment create is limited to exactly the James comment kinds | tests/rules/web-threads-b1-4.rules.test.ts::James deletes his own comment",
      "issue": "The static test requires the exact text `allow update, delete: if isOwner() && resource.data.author == 'james' && authoredByJames();` with authoredByJames() reading request.resource (null on delete), while the emulator test requires delete to succeed, so the two can only both pass through a duplicate top-level comments match block hack.",
      "fix": "Drop the out-of-scope delete test (preferred) or stop the static test pinning the update/delete line; in either case the two suites must not contradict each other."
    },
    {
      "type": "out-of-scope-test",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::James deletes his own comment",
      "issue": "Criterion 4 covers writing the new fields, comment kinds and todos, and the spec's Out of scope list explicitly excludes \"Editing or deleting sent messages\", yet this test is red evidence that forces a rules change the spec does not ask for.",
      "fix": "Remove it, or get the spec amended first to make comment deletion an explicit B1 requirement."
    },
    {
      "type": "out-of-scope-test",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::James edits his own comment",
      "issue": "Editing sent messages is explicitly out of scope in the spec and is not part of criterion 4.",
      "fix": "Remove it, or keep it only as a labelled baseline regression guard with the spec's agreement."
    },
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::James cannot send a session kind (\"spec\")",
      "issue": "Only one of the seven session kinds is tried, and no unknown kind is, so the emulator test alone cannot show that create is limited to exactly the six James kinds.",
      "fix": "Loop over all SESSION_KINDS plus an unknown kind (e.g. 'bogus') and assertFails on each."
    },
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::<stranger|unverified James|anonymous>: task read/write, comment create, todo/project/agent reads",
      "issue": "Criterion 4 says any other principal's write is refused, but other principals are never tried on todo writes, project writes, updateDoc of an existing task's new fields, or the agent doc; only a new task create and a comment create are tried.",
      "fix": "Add assertFails for setDoc/updateDoc on todos/x1, projects/p1, updateDoc of tasks/t1 with the new fields, and setDoc on agents/a1 for each of the three principals."
    },
    {
      "type": "missing-edge-case",
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::a stranger cannot read it",
      "issue": "The new log_archive rule is only checked for a stranger's read; writes, and the unverified and anonymous principals, are not tried.",
      "fix": "Loop over all three other principals and assertFails both getDoc and setDoc on tasks/t1/log_archive/e1."
    },
    {
      "type": "hygiene",
      "where": "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules",
      "issue": "These checks are structural (rules text, exact wording and term order, an inline `kind in [...]` list), so a behaviourally correct rule using a helper function fails, and they now duplicate the emulator test while contradicting it.",
      "fix": "Cut the static rules checks down to a minimal default-deny/no-`if true` guard, or remove them, and rely on the emulator test; keep the indexes describe."
    },
    {
      "type": "hygiene",
      "where": "tests/web-threads-b1-4.test.ts::(file header)",
      "issue": "The file-top comment still says the emulator test is deferred because Java is not installed, which is now false.",
      "fix": "Update the comment to point at tests/rules/web-threads-b1-4.rules.test.ts."
    },
    {
      "type": "hygiene",
      "where": "criterion 4",
      "issue": "Criterion 4 is split across two test files, against the packet's one-file-per-acceptance-ID rule (the addendum keeps both without resolving that).",
      "fix": "Either record the split as an explicit waiver (static = indexes only) or move the indexes describe into the contract file and keep rules in the emulator file."
    },
    {
      "type": "uncovered-criterion",
      "where": "Selected new contract: Agent compat in B1 (`status: 'done'` on a key advances `stage`; `kanban_update_task { status: 'in_progress' }` clears `needs`)",
      "issue": "packages/agent/test/protocol.ts tests the spec arming, ask, answer clearing and update_task done, but neither the subtask `status:'done'` stage advance nor `in_progress` clearing needs.",
      "fix": "Add live assertions: kanban_subtask {key:'spec', status:'done'} moves stage past spec, and kanban_update_task {status:'in_progress'} after ask sets needs to literal null."
    },
    {
      "type": "hygiene",
      "where": "packages/agent/test/protocol.ts",
      "issue": "No red evidence was supplied for the edited live assertions; they run only against real Firestore and were not part of the red runs.",
      "fix": "Capture a KANBAN_TEST_LIVE=1 npm run test:agent run that shows the new assertions failing for missing behaviour, not because the fixture can't run."
    },
    {
      "type": "weak-assertion",
      "where": "tests/web-threads-b1-contract.test.ts::a new feature task starts at spec with every new field empty",
      "issue": "toMatchObject accepts extra keys, so only the five named retired keys are excluded and stray fields (including `id`, which Omit<Task,'id'> excludes) go unnoticed.",
      "fix": "Assert Object.keys(t).sort() equals the exact Omit<Task,'id'> key list, or use toEqual on the full expected object."
    },
    {
      "type": "missing-edge-case",
      "where": "tests/web-threads-b1-contract.test.ts::isQueued",
      "issue": "No isQueued case uses a task with after-deploy steps, although the contract derives the first stage from stagesFor(type, afterDeploy.length > 0).",
      "fix": "Add isQueued({type:'chore', afterDeploy:['x'], stage:'do', agentId:null}) === true."
    }
  ],
  "gaming_flags": [
    {
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::James cannot send a session kind (\"spec\")",
      "stub_that_passes": "allow create: if isOwner() && authoredByJames() && request.resource.data.kind != 'spec'; (only the structural static test catches this)"
    },
    {
      "where": "tests/rules/web-threads-b1-4.rules.test.ts::<stranger|unverified James|anonymous>: task read/write, comment create, todo/project/agent reads",
      "stub_that_passes": "match /todos/{id} { allow read: if isOwner(); allow write: if request.auth != null; } plus match /tasks/{id} { allow read, create: if isOwner(); allow update: if request.auth != null; } (only the structural static test catches this)"
    }
  ]
}
```

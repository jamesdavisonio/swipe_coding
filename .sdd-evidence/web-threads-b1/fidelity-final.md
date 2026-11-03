# Fidelity gate — final (delta check of the round-8 repairs: CLOSED, 0 regressions)

Process note: rounds 4–8 were full fresh-context audits after each revision. James stopped that
on 2026-11-03: the loop is "repair what was found, confirm only that". Round 8's five gaps were
repaired by the author and this scoped delta check confirmed each closure and no regressions.
The human's written acceptance of this procedure is in the session transcript.

Checker: fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile anthropic-only
(isolation: context); inputs = round-8 gaps JSON, the four repaired files, the spec, the three red
captures. Re-ran unit (37 failed / 2 passed) and rules (11 failed / 23 passed); agent capture red
at the create brief. Hygiene: no `.only`/`.skip`; only the pre-existing, spec-waived poll loops.

Unrelated observation (checker): the protocol script stops at its first failing assert, so the
new `approved → build` check has no red capture of its own; it is sequential by design.

Verbatim verdict JSON:

```json
{
  "verdict": "CLOSED",
  "gaps": [
    {
      "gap": "tests/web-threads-b1-contract.test.ts::initialTaskFields > a new feature task is exactly the contract shape",
      "closed": true,
      "evidence": "New test 'initialTaskFields > echoes its inputs into the task' passes projectId 'p2', title 'Other', description 'Desc 2', now 1_700_000_000_123 and asserts expect([t.projectId, t.title, t.description, t.createdAt, t.updatedAt]).toEqual(['p2','Other','Desc 2',1_700_000_000_123,1_700_000_000_123]); the stub hardcoding 'p1'/'T'/'D'/1_800_000_000_000 fails it."
    },
    {
      "gap": "tests/web-threads-b1-contract.test.ts::isQueued > stageIndex follows the stage list and is -1 for a stage not in it",
      "closed": true,
      "evidence": "Same test now also asserts stageIndex({type:'feature',afterDeploy:[],stage:'spec'}).toBe(0), feature 'pr' .toBe(3), bugfix 'merged' .toBe(2) and feature afterDeploy ['smoke'] 'done' .toBe(7); the 'includes ? 6 : -1' stub fails all four."
    },
    {
      "gap": "packages/agent/test/protocol.ts::subtask spec done → stage <stage>",
      "closed": true,
      "evidence": "After 'subtask spec done → stage approved', the same live sequence calls kanban_subtask {key:'approved', status:'done'} and asserts snap.get('stage') === 'build' ('subtask approved done → stage ...'); a key==='spec'-only special case leaves stage 'approved' and fails."
    },
    {
      "gap": "tests/rules/web-threads-b1-4.rules.test.ts::comment kinds (owner read missing)",
      "closed": true,
      "evidence": "New test 'owner writes the new task fields, todos and projects > reads back seeded comments (both authors), a todo and a project' seeds comments/j1 (james), comments/a1 (agent), todos/x1, projects/p1 and runs assertSucceeds(getDoc(doc(james(), path))) for each; a comments-block rewrite dropping the owner's read fails it. Passes against today's rules (23 passed)."
    },
    {
      "gap": "tests/web-threads-b1-4.test.ts::B1-4 firestore.rules minimal text guards",
      "closed": true,
      "evidence": "The 'B1-4 firestore.rules minimal text guards' describe block, including the exact-string 'allow read, write: if false;' guard, is removed; the file now holds only the three firestore.indexes.json checks, and its header points rules behaviour to the emulator test, whose 'default deny' and 'agents stay read-only' tests still run and pass."
    }
  ],
  "regressions": []
}
```

# Evidence: launch-session (criteria 116–126)

Spec: `docs/features/launch-session.md`, approved by James on the board on 2026-11-09 at 07:13
(approve, comment `oH2tOFtkZjJHSDISLVDC`), after one change request (the project list shows the
board's projects by their real names; James chose "Board projects, real names").

Profile: anthropic-only (isolation: context). Test author: an isolated Sonnet context. Fidelity
checker: an isolated Opus context, a fresh one per delta round. Implementer: an isolated Opus
context, without the fidelity verdicts; the review repair ran in another fresh Opus context.
Reviewer: a fresh Opus context, and a fresh one for the scoped re-review.

## 1. Commits since the red checkpoint (`af710ce`)

```
388ada6 fix(launch-session): stop claiming and starting once the lease is lost
e056ba8 fix(launch-session): refuse a session name that starts with "-"
a6d0e2f fix(launch-session): read the session id from either stream, colours stripped
4b87803 test(launch-session): approved post-freeze amendment (mock order, casts)
e13832f refactor(launch-session): name the launch transitions and read any rejection safely
7f862fc refactor(launch-session): the dictated idea lives with the deck, the sheet under 50 lines
aee01a8 refactor(launch-session): one ProjectSelect for New task and New session
220ff4d docs(launch-session): keep code spans on one line so prettier passes
7e7cf58 docs(launch-session): the notifier also starts sessions
fe9d883 feat(launch-session): the notifier starts requested sessions through the launcher
a88b1be feat(launch-session): New session button and sheet on the deck
22922e5 feat(launch-session): rules let the phone only request a launch
333b348 feat(launch-session): createTask can ask the PC to start a session
f410819 feat(launch-session): Task.launch in @kanban/shared
```

## 2. Test changes after red

One approved amendment, `4b87803` (6 insertions, 10 deletions in 3 files). The built feature
showed three 118 tests setting their `createTask` mock before the shared deck fixture reset it,
so those tests failed whatever the code did; two casts had become redundant and one fixture cast
was needed once `Task.launch` was typed. Escalated with a round brief; James replied
"another round" on the board (2026-11-09, comment `NLJRlVEHarm1UY3zSlzL`). The test author moved
the three mock lines after `open()` and fixed the casts; no assertion changed. A fresh delta check
passed it (section 4). `git diff 4b87803..HEAD -- tests` is empty.

## 3. Checks on HEAD (`388ada6`, run by the orchestrator)

- Emulator and rules, full suite (`firebase emulators:exec … vitest.rules.config.ts`, Java 21):
  72 files, 501 tests passed, exit 0.
- Unit (`npm test`): 117 of 118 files, 998 of 1003 tests passed, exit 1. All 5 failures are in
  `tests/fix-tests-never-live.test.ts` ("Access to this API has been restricted", Node's
  `--permission` sandbox): in this worktree `node_modules` are junctions into the main checkout,
  outside the folder the test allows. It fails the same way at the red checkpoint and only imports
  `firestore.ts`, which this change does not touch. CI on the PR runs it with a real install.
- `npm run test:agent`: all good (offline). `npm run typecheck`: exit 0. `npx eslint .`: 0 errors
  (21 warnings, unchanged files). `npx prettier --check .`: clean.
- Red run (af710ce): jsdom 34 of 34 failed (no "New session" button; `launcher.ts` missing);
  emulator and rules 53 failed and 5 passed (guard cases true today: create without `launch`,
  other edits allowed, stranger refused, `launch: false` writes nothing, a busy lease starts
  nothing).
- Real launch, once, by the orchestrator: this branch's `claudeLaunchPort` (prefix
  `--strict-mcp-config --model haiku`, a scratch folder) started a real `claude --bg` session,
  resolved its id (`b82dc4b0`) in 1.2 s, and the session outlived the node process
  (`claude agents --json`); it was then stopped and removed.

## 4. Fidelity gate

Full audit FAIL (12 gaps, 3 gaming flags: a no-card default equal to the first project, a
launcher never stopped, a real port that could use a shell). Contract decisions recorded first
(spec block "Contract decisions added after the first fidelity check": `requestedAt` kept, an
interrupted claim reported like any failure, the WARNING `status` values, the real port's
`command`/`prefixArgs` seam, the `user_action` event). Delta round 1: 1 gap and 2 regressions
left (15 → 3). Delta round 2: 1 left (a fixture the emulator could not run at a 20 ms heartbeat).
Delta round 3: PASS.

```json
{
  "verdict": "PASS",
  "criteria_map": [
    {
      "criterion": "The notifier, while it holds the lease, starts one session for each task whose `launch.state` is `requested` and whose project's `hostname` is this PC's; tasks of projects on other PCs are left alone. It does this for requests made while it was not running too.",
      "tests": [
        "tests/emulator/launch-session-121.test.ts::starts one session for each requested task on this PC, in its project folder",
        "tests/emulator/launch-session-121.test.ts::starts a request written while it is running",
        "tests/emulator/launch-session-121.test.ts::starts a request made while it was not running, when it starts",
        "tests/emulator/launch-session-121.test.ts::leaves the tasks of projects on other PCs alone",
        "tests/emulator/launch-session-121.test.ts::does not start anything while another notifier holds the lease",
        "tests/emulator/launch-session-121.test.ts::a stopped notifier starts nothing; the next one starts the request once",
        "tests/emulator/launch-session-121.test.ts::a notifier that lost its lease starts nothing more"
      ]
    }
  ],
  "gaps": [],
  "gaming_flags": []
}
```

Amendment delta check (post-freeze, `4b87803`): PASS, `gaps: []`, `gaming_flags: []`; it
confirmed a build that ignores a failed or pending save can no longer pass 118 (before the fix it
could).

## 5. Review

Fresh review: needs-changes, one blocking issue: a title starting with "-" would be read by
`claude` as an option (`--remote-control [name]` takes an optional value), so a title could add a
flag such as an MCP server command. Repaired in a fresh build context (`e056ba8`), together with
two listed follow-ups: re-checking a lost lease before the claim and before starting (`388ada6`),
and reading the session id from either stream with colour codes stripped, then releasing the child
(`a6d0e2f`). Scoped re-review: **shippable**. It checked the fix against Commander's own option
test inside the installed `claude` (leading whitespace and dash-only names refused on both sides;
Unicode dashes are values to Commander), and the stream handling with fake scripts (stderr with
colour codes, one byte at a time, two id lines, exit codes, ENOENT, a child that keeps running).

Follow-ups (not built):

- The three review fixes have no tests (the tests were frozen); add them in the next round.
- Anchor the session-id pattern to the start of a line, so a title that repeats
  "backgrounded · x · " can never be read as the id.
- Destroying the pipes kills a front process that writes after the id line; the real
  `claude --bg` hands off to its background service, so it is fine today.
- A start_session failure logs under the threads feature name, not `launch-session`.
- `TYPES` in `NewSessionSheet.tsx` repeats the task type list.
- The 122 port tests leave temporary folders behind.
- Not verified: that a launched session appears in the desktop app's Code tab (it shows in
  `claude agents` and has a Remote Control link); the first real launch will show it.

# Evidence: fix-question-keeps-spec

Fix confirmed by James on the board on 2026-11-09 ("fix confirmed", comment
`Y5O0rUmQI7N38mPqizLs`), task `w8EKsi30ediDay2NajDU`. Class: Small (agent and web, one shared
helper).

Cause: a task waits on one thing at a time. On 9 November DT's support-ticket session put its spec
up for approval and 0.1 s later asked a question (`Board.ask`), which replaced the spec need;
James's answer cleared the need, and the spec card never came back, so he confirmed in the chat.

Contract: the question need carries `resume?: { kind: 'spec' }`, set by `Board.ask` over a spec
need; every answer path (phone, voice or typed note, thread reply box, session chat, and the
session watcher's claim) writes `needAfterAnswer(task)`, which brings the spec back only while the
stage is `spec` or `approved`; passing the spec stage drops `resume`.

Profile: anthropic-only (isolation: context). Repro and amendment tests: the orchestrator (plan
role, as the fix chain's debug hop). Implementers: isolated Opus contexts (first fix, then a
repair). Reviewers: fresh Opus contexts.

## 1. Commits since the red checkpoint (`2ffba62`)

```
574d89b test(fix-question-keeps-spec): approved post-freeze tests for the review's holes
8377087 fix(board): the watcher keeps the spec a question was asked over; resume ends past spec
1fc83ef fix(board): a question asked while the spec waits brings the spec back once answered
```

## 2. Test changes after red

One approved addition, `574d89b`: `tests/emulator/fix-question-keeps-spec-review.test.ts` (3
tests, no existing test changed). James replied "another round" (recorded on the board,
`81wG1kS0giT9pMdq9GAV`). All three fail on `1fc83ef` and pass on `8377087`.

## 3. Checks

- Repro: red at `2ffba62` (3 failed: "expected null to deeply equal { kind: 'spec' }"; 2 guards
  passed), green after `1fc83ef` (5 passed). Amendment tests: 3 failed on `1fc83ef`, 3 passed on
  `8377087`.
- Emulator suite: 73 files, 506 tests passed (implementer); the re-reviewer's runs saw single
  flaky failures elsewhere (gRPC "call already cancelled", a load timeout) that pass in isolation
  (29/29 for the touched and flagged files).
- `npm test`: all pass except `tests/fix-tests-never-live.test.ts`, which cannot read this
  worktree's junctioned `node_modules` from its Node permission sandbox (environment only).
- `npm run test:agent`: all good. `npm run typecheck`: exit 0. `npx eslint .`: 0 errors. Prettier:
  clean.

## 4. Review

First review: needs-changes. (1) The session's watcher claimed James's answer a second later and
cleared the need, wiping the spec that had come back. (2) A question carrying `resume` survived
the spec stage being passed, so an answer after "spec confirmed" in the chat brought back a spec
card that could not be approved. (3) The thread reply box had no test. Repaired in a fresh build
context (`8377087`) and covered by the approved tests. Scoped re-review: **shippable**.

Follow-ups (not built):

- A question asked over a merge or after-deploy card still replaces it (same bug class).
- `sendReply` writes from the phone's snapshot of the task, so in the short window after the
  session passes the spec stage a reply could still restore the spec need.
- Test 2 passes with either half of the issue-2 fix, so neither half is pinned alone.
- Phones still on the previous web build clear the need to null, as before, until they reload.

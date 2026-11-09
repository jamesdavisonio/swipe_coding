# Evidence: pr-ready (criteria 127–134)

Spec: `docs/features/pr-ready.md`, approved by James on the board on 2026-11-09 at 11:14 (approve,
comment `r3pdCS6qhheEVVzvsOP4`). James asked: a merge card should reach him only once the PR has
passed every check, for every session.

Profile: anthropic-only (isolation: context). Test author: an isolated Sonnet context. Fidelity
checker: an isolated Opus context, a fresh one per round. Implementer: an isolated Opus context,
without the fidelity verdicts; the review repair ran in another fresh Opus context. Reviewer: a
fresh Opus context, and a fresh one for the scoped re-review.

## 1. Commits since the red checkpoint (`31b848f`)

```
c98179e test(pr-ready): approved post-freeze tests for the review's findings
594c91a fix(pr-ready): a push while pending restarts the no-checks grace; gh gets https urls only; a malformed pr loses only the merge card
02f0eb1 docs(pr-ready): the notifier's PR watcher in notifier.md and AGENTS.md
10bce6c feat(pr-ready): label ci_failed comments in the thread
e361cf7 feat(pr-ready): the notifier watches PR checks and notifies the merge card
3ec34ac feat(pr-ready): a reported PR waits on its checks; the watcher prints ci_failed
33bf961 feat(pr-ready): GithubPort reading a PR's checks through gh, never under the emulator
4368de5 feat(pr-ready): PR checks fields, ci_failed comment kind and the merge notice
```

The red checkpoint was committed with `--no-verify`: eslint's only errors were two type-only
fixture lines that could not resolve until `github.ts` existed (clean once it did).

## 2. Test changes after red

One approved addition, `c98179e` (two new files, nothing changed): a new head while pending
restarts the no-checks grace (2 tests; both fail before `594c91a`, pass after), and the default
GitHub port never runs `gh` under the emulator. James replied "another round" (recorded on the
board, `C7gkqncULDDvxlg3nINA`).

## 3. Checks on HEAD

- Emulator and rules, full suite on the default port: 81 files, 553 tests passed (re-reviewer);
  80 files, 551 tests before the added tests (orchestrator).
- Red run (31b848f): pr-ready 127–134 plus b7-34 and decision-notifications-79, 52 failed and 13
  passed (guards for unchanged behaviour); the two node files failed to load (`github.ts`
  missing). Green: 65 of 65, and 9 of 9 node tests.
- `npm test`: 121 of 122 files; the failures are `tests/fix-tests-never-live.test.ts`, which
  cannot read this worktree's junctioned `node_modules` from its Node permission sandbox
  (environment only; CI runs it).
- `npm run test:agent`: all good. `npm run typecheck`: exit 0. `npx eslint .`: 0 errors. Prettier:
  clean.

## 4. Fidelity gate

Full audit FAIL (12 gaps, 3 gaming flags: a merged PR passing only by the normal rule, giving up on
elapsed time alone, an incomplete failure list), plus older suites that would have reached the
real `gh`. Contract decisions recorded first (spec block "Contract decisions added after the first
fidelity check"). Delta round 1: **PASS** (`gaps: []`, `gaming_flags: []`). One more decision
before the freeze: the default GitHub port never runs `gh` under the emulator.

## 5. Review

Fresh review: needs-changes, one blocking issue: a push while a PR was pending could pass on the
no-checks grace before the new head's checks registered, showing a merge card too early. Repaired
(`594c91a`, in memory, no extra writes) together with two follow-ups: non-https PR urls never
reach `gh` (`bad_url`), and a malformed `pr` loses only the merge card. Scoped re-review:
**shippable**.

Follow-ups (not built):

- A push while the notifier is down, on a pending task with no recorded head, can still pass on
  the first read after restart (closing it costs one write per run: record `pr.head` on the first
  read).
- No tests for `bad_url` or the malformed-`pr` case (checked by probes).
- A check concluded `STALE` keeps a PR pending; a long-failed open PR is read every minute
  indefinitely; a conflict-only failure is re-reported after each push to main.
- Sessions on older agents read a `ci_failed` line as James's words (their instructions predate
  it); check names come from workflow files.
- If the notifier ever runs as a child of the desktop app, `gh`'s login may sit in a virtualised
  `%APPDATA%`; the logon task avoids this.

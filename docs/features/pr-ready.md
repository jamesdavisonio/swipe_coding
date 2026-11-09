# Feature: Merge card only once the PR's checks have passed

**Status:** Draft (awaiting James's approval on the board)
**Date:** 2026-11-09
**Task class:** Medium (the notifier gains a PR watcher that calls GitHub; the merge need moves
from the session agent to the notifier; criteria 127–134, numbering continues from
`launch-session.md`, 116–126).

## Decision brief (spec)

Yes: Show a merge card only when the PR is ready to merge

### Where it came from

You asked on 9 November: a "merge this PR" card should only reach you once the PR has passed every check, for every session.

### Why it exists

Today the card appears the moment a session opens its PR, while the checks still run, so you tap through to GitHub and wait.

### What will change

The notifier on the PC watches each PR's checks. When all pass, the merge card appears and your phone is notified. If a check fails, no card: the session is told which check failed so it can fix it.

### Key assumptions

GitHub's own CLI on the PC (already signed in) reads the checks. A PR whose repo has no checks counts as ready after two minutes.

### Out of scope

Merging for you, and reviews or approvals on GitHub.

### What you're agreeing to

One build to a pull request; it works for every session at once, without restarts.

## What the user sees

A session reports its PR as today. The task moves to the PR stage but shows no merge card while
the PR's checks run (the thread says "Checks running on PR #<n>"). When every check has passed and
GitHub says the PR can be merged, the merge card appears, as today, and the phone gets a
notification ("Merge · <project>", the task's title). If a check fails, no merge card appears: the
thread says "Checks failed on PR #<n>: <check names>", and the session hears it through its
watcher so it can fix and push; the new run is watched the same way. James never sees a merge card
for a PR that is still running checks or has failed ones.

## Acceptance criteria

127. When a session sets a PR on a task in a stage that today makes it wait on James's merge
     (`build`, `fix`, `do`, `pr`), the task moves to `pr` with `pr.checks: 'pending'` and no need;
     the deck shows no merge card for it.
128. The notifier (while it holds the lease) watches every task whose `pr.checks` is `pending`.
     When all of the PR's checks have completed successfully (skipped and neutral count as passed)
     and GitHub reports it mergeable, it sets `pr.checks: 'passed'` and the need `{ kind: 'pr' }`,
     so the merge card appears.
129. A task whose need becomes `pr` while its PR's checks are not known to have passed (a session
     on an older agent sets the need directly) is treated as in 127: the notifier clears the need,
     sets `pr.checks: 'pending'` and watches it. Every session gets the new behaviour without a
     restart.
130. When any check has failed (failure, cancelled, timed out, action required), the notifier sets
     `pr.checks: 'failed'` with the failed checks' names, writes one comment in the task's thread
     "Checks failed on PR #<n>: <names>", and the session's watcher prints it (kind `ci_failed`) so
     the session can fix it. No merge card appears.
131. After a failure, a new run of the PR's checks (a push) is watched again: the task goes back to
     `pending` and then as in 128 or 130. A failure is reported once per run.
132. A PR with no checks at all counts as passed two minutes after it was set; a merged or closed
     PR stops being watched (merged: the need is set as in 128 so James can confirm it; closed:
     `pr.checks: 'closed'` and a comment).
133. When reading the checks fails (GitHub unreachable, the CLI missing or signed out), the
     notifier keeps the task pending, logs one `api_call_failed` WARNING (`target: github`,
     `task_id`, `status`) per task per hour at most, and keeps trying; after 30 minutes of failed
     reads it shows the merge card anyway, with a thread note that the checks could not be read.
134. A merge card that appears (128) notifies the phone once per PR, like a decision card
     ("Merge · <project>", the task's title).

## Out of scope

- Merging for James; GitHub reviews, approvals or branch protection.
- Showing the run's progress on the card.

## Public contract and existing boundaries

**Observed baseline** (main at `4b6172b`):

- `packages/agent/src/board.ts` `prPatch(task, url)`: from `build`/`fix`/`do`/`pr` it sets
  `pr: { number, url }`, `stage: 'pr'`, `needs: { kind: 'pr' }`.
- `packages/agent/src/notifier.ts`: lease holder, one `tasks` listener, decision keys and
  `notified`; `launcher.ts` already rides on that listener.
- `packages/agent/src/wait.ts`: prints comments authored by James.
- `gh` 2.x on this PC, signed in: `gh pr view <url> --json state,mergeable,statusCheckRollup`
  returns each check's `status` and `conclusion` (checked on PR #36:
  `fast-feedback IN_PROGRESS`, `mergeable: MERGEABLE`).
- The web shows a merge card for `needs.kind === 'pr'` (`packages/web/src/lib/deck.ts`).

**Selected new contract:** decided before the tests.

## Instrumentation

| event_type        | severity | context keys                          | audience |
| ----------------- | -------- | ------------------------------------- | -------- |
| `api_call_failed` | WARNING  | `target: github`, `task_id`, `status` | internal |

## Open questions

- None.

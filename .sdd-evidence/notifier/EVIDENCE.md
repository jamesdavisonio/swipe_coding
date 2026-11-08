# Evidence: notifier (criteria 107–115)

Spec: `docs/features/notifier.md`, confirmed by James on the board on 2026-11-08 at 09:08 (approve,
comment `za3Ckm4Qws80xc3jNagH`). Supersedes the sender in `decision-notifications.md` (77–83 keep
their behaviour).

Profile: anthropic-only (isolation: context). Test author: an isolated Sonnet context. Fidelity
checker: an isolated Opus context, a fresh one per delta round. Implementer: an isolated Opus
context, without the fidelity verdicts. Reviewer: a fresh Opus context.

## 1. Commits since the red checkpoint (`2a8518f`)

```
013243f docs(notifier): the notifier is the sender; how to run it
d6542ef feat(notifier): npm run notifier and the Windows logon task
35dccf3 feat(notifier): one notifier sends every session's decision notifications
bdb1f98 feat(shared): notified key, notifier collection, NEED_KINDS for the notifier
```

## 2. Test changes after red

None: `git diff 2a8518f..HEAD -- tests` is empty.

## 3. Checks on HEAD (implementer's run, re-run in part by the reviewer)

- Emulator and rules, full suite (`npm run test:rules`, Java 21): 65 files, 445 tests passed.
- Unit (`npx vitest run --maxWorkers=6`): 103 files, 912 tests passed.
- `npm run test:agent`: all good (offline). `npm run typecheck`: exit 0. `npm run lint`: 0 errors
  (16 warnings, tests only, unchanged).
- Red run: 90 of 95 notifier and decision-notification emulator tests failed, each for missing
  behaviour (notifications never arrive, the session agent still sends, the stub never refuses a
  busy lease); the 5 passing are criterion 76, unchanged. `tests/notifier-115.test.ts`: 5 of 6
  failed (the script and the npm scripts did not exist).

## 4. Fidelity gate

Full audit FAIL, then delta rounds 1 and 2 FAIL; everything about the notifier's behaviour closed
by round 2. What did not converge was the static check of `scripts/notifier-task.ps1`, read as
text. Escalated with a round brief; James replied "another round" on the board (2026-11-08 15:39),
on the brief's terms: one more round with the script's rule pinned tighter (contract bullet "Before
delta round 3"), and if that did not settle it, the script is checked by hand after merge.

Round 3 closed its three items (strings spanning lines, names in trailing comments, a decoy string
line). The check then found two same-line variants still open:

- a decoy string on the `New-ScheduledTaskAction` line (the `-Execute`/`-Argument` checks read the
  line's strings, not the string bound to each parameter);
- a decoy `"-TaskName 'kanban-notifier'"` string beside a register call with another name.

Per the brief, these stay open in the test and the script was checked by hand instead: the
reviewer read it (below), and after merge the install is checked on the PC.

## 5. Fresh-context review

**shippable.** Every criterion maps to tests that failed on the red stub; no gaming markers; no
test changes; no duplicated helpers (two removed: `firestoreFailure` moved to `app-log.ts`,
`NEED_KINDS` to `@kanban/shared`). A failed send still writes `notified`, as the contract says.

Install script read by hand: one literal `New-ScheduledTaskAction` line running `powershell.exe
-NoProfile -WindowStyle Hidden -Command "npm run notifier"` in the repo root; `-AtLogOn` for the
current user, no admin; `-RestartCount 999`, 1-minute interval, no time limit; install registers
and starts it; uninstall stops and unregisters it. Valid in Windows PowerShell 5.1.

Follow-ups (not blocking):

1. `node --watch` stays alive when the notifier exits (for example "not started" if the network is
   not up at logon), so Task Scheduler's restart never fires; the notifier stays down until a code
   change or the next logon.
2. A notifier that loses its lease stops sending and never tries to reclaim it.
3. A heartbeat in flight during `stop()` can log a misleading "lost its lease" line.
4. Each snapshot of a task waiting on a spec queries its comments (fine at this scale).

## Not verified

- The logon task on the real PC: after merge, `npm run notifier:install` from the main kanban
  folder, then confirm the task exists, the notifier runs, and a question reaches the phone.
- Whether uninstall also ends the `node` processes under the task (check Task Manager).

# Feature: One notifier for every session

**Status:** Drafting
**Date:** 2026-11-08
**Task class:** Medium (one new process in the agent package, the push moved out of the session
agents; criteria 107–115, numbering continues from `todo-drawer.md`, 98–106). Supersedes the
"sent by the session's agent" part of `decision-notifications.md` (criteria 77–83 keep their
behaviour; the sender changes).

## Decision brief (spec)

Yes: Build one notifier that sends every session's decision notifications

### Where it came from

You asked on 8 November for notifications without restarting sessions each time the agent changes, and chose the notifier on the board.

### Why it exists

Each session only sends notifications if it started after the feature merged, so DT, Workshop and Kanban stay silent until restarted, and context gets lost.

### What will change

One process on the PC watches the board and sends the notification whenever any session's task starts waiting on you, whatever version of the agent that session runs. For example, DT [N] asks a question and your phone shows "Question · data-trackers" without DT being restarted.

### Key assumptions

It runs all the time on the PC, started when you log in, and restarts itself when the agent code changes. You install the login entry once by running one command.

### Out of scope

The agent reloading its own code (proposal B, later), and notifications for anything other than decisions.

### What you're agreeing to

One build to a pull request, then one command on the PC to start it at login.

## What the user sees

Nothing new on the phone: the same notifications as `decision-notifications.md` (spec, CI failed,
fix, another round, ship it, question; "Spec · kanban" with the card's headline; tapping opens that
card). What changes is who sends them: one notifier process on the PC instead of each session's
agent, so every session's decisions notify, including sessions started before notifications
existed. James starts it once with `npm run notifier`, or has it start at login by running
`npm run notifier:install` once (a Windows logon task); it restarts itself when the agent's code
changes on disk, so pulling main is enough.

## Acceptance criteria

107. Given the notifier runs and devices are registered, when a task's need becomes a spec
     (`needs.kind` `spec`) — written by any agent version, through any path — each device receives
     one notification equal to `decisionNotice(task, <project name>, <latest spec brief>)`, where the
     latest spec brief is the body of the task's newest session comment that holds a well-formed
     spec brief (else no spec body).
108. Given the same, when a task's need becomes a question (`needs.kind` `question`, with or
     without options), each device receives one notification equal to
     `decisionNotice(task, <project name>)` (the deck's kind and headline: CI failed, Fix, Another
     round, Ship it, Question).
109. A revised spec (a newer spec brief comment while the need is still `spec`) or a different
     question on the same task notifies again, under the same tag. Any other change to the task
     while its decision is unchanged (comments, stage, `updatedAt`, `working`, `lastCommentAt`)
     sends nothing.
110. A need of `pr`, `after_deploy` or none sends nothing.
111. A decision is notified once: after the notifier restarts it does not send decisions it already
     sent, and a decision that appeared while it was not running is sent when it starts.
112. Sending failures and dead tokens are handled as in 82–83: one `api_call_failed` WARNING
     (`target: fcm`, `status`, `task_id`, `device_count`, `removed`) per failed send, readable through
     `kanban_logs`; tokens the push service reports unregistered are deleted. No failure stops the
     notifier.
113. Session agents no longer send decision notifications: `kanban_subtask` spec →
     `awaiting_approval` and `kanban_ask` write the decision exactly as before and send nothing.
114. Only one notifier sends: a second one started while the first is live sends nothing and
     exits with a message saying another notifier is running; when the live one stops (or its lease
     is older than 2 minutes) a new one takes over.
115. `npm run notifier` runs it with Node's watch mode, so a change to its code or anything it
     imports restarts it; `npm run notifier:install` registers a Windows logon task that runs it
     from this folder (hidden window, restart on failure), and `npm run notifier:uninstall` removes it.

## Out of scope

- The agent reloading its own tool code without a session restart (proposal B).
- Any notification other than decision cards; quiet hours; clearing answered notifications.
- Running the notifier anywhere but this PC (no Cloud Functions).

## Public contract and existing boundaries

**Observed baseline** (main at `a7b1b0c`):

- `packages/agent/src/push.ts`: `notifyDecision(db, push, task, specBody?)` reads devices with zod,
  sends through `PushPort.sendDecision`, removes unregistered tokens, logs one `api_call_failed`
  through `logFailure`, never rejects; `fcmPush()` sends nothing under `FIRESTORE_EMULATOR_HOST`.
- `packages/agent/src/board.ts`: `setSubtask` (`awaiting_approval`, line ~506) and `ask` (~560) call
  `notifyDecision`; `Board` takes `push: PushPort = fcmPush()`.
- `packages/shared`: `decisionNotice`, `parseBrief`, `COLLECTIONS`, `Task`, `Comment`.
- `packages/agent/src/firestore.ts`: `getDb()`, `log()`; `app-log.ts`: `logFailure`,
  `setLogIdentity(agentId, projectId)`.
- Node 24 supports `node --watch`.

**Selected new contract** (planner decisions within the confirmed scope):

- New `packages/agent/src/notifier.ts` exporting
  `startNotifier(opts: { db?: Firestore; push?: PushPort; now?: () => number; leaseMs?: number }): Promise<Notifier>`
  with `Notifier = { stop(): Promise<void> }` (rejects with `NotifierBusyError` when another live
  notifier holds the lease), and a CLI entry (`node packages/agent/src/notifier.ts`) that starts it
  and logs to stderr / `agent.log`.
- The notifier listens to `tasks` (one listener) and, for each task whose need is `spec` or
  `question`, computes a decision key: `spec:<id of the newest session comment holding a spec
brief>` (or `spec:none`), `question:<the question text>`; it sends when the key differs from the
  task's stored `notified` field and then writes `notified: <key>` on the task (Admin SDK). A task
  with no decision gets nothing written.
- Lease: document `notifier/lease` `{ pid, hostname, startedAt, lastSeen }`, heartbeat every 30 s,
  live while `lastSeen` is under `leaseMs` (default 120 000) old; `stop()` deletes it. Firestore
  rules deny the browser the `notifier` collection (default deny already does).
- `Board.setSubtask` / `Board.ask` stop calling `notifyDecision`; `Board`'s `push` argument is
  removed. `notifyDecision` stays in `push.ts` for the notifier.
- Root `package.json` scripts: `notifier` = `node --watch packages/agent/src/notifier.ts`,
  `notifier:install` / `notifier:uninstall` = `powershell -File scripts/notifier-task.ps1 install|uninstall`
  (task name `kanban-notifier`).

**Unresolved:** none.

## Files & modules affected

- `packages/agent/src/notifier.ts` (new), `push.ts`, `board.ts`
- `packages/shared/src/index.ts` (`Task.notified?: string`, `COLLECTIONS.notifier`)
- `scripts/notifier-task.ps1` (new), root `package.json`
- `docs/features/decision-notifications.md` (sender superseded), `AGENTS.md` (how to run it)
- Tests: `tests/emulator/notifier-<id>.test.ts`, updates to the decision-notifications agent tests
  that expect the session agent to send

## Principles that apply

- `idempotency` — one notification per decision via the stored `notified` key; one sender via the
  lease.
- `graceful-degradation` — a failed send or a Firestore listener error is logged and the notifier
  keeps running (a dead listener is re-created).
- `observability` — failures through `logFailure` (`api_call_failed`), start/stop and lease
  messages through `log()`.
- `io-validation` — task and comment documents are read defensively (unknown shapes are skipped).

## Instrumentation

| event_type        | severity | context keys                                                   | audience |
| ----------------- | -------- | -------------------------------------------------------------- | -------- |
| `api_call_failed` | WARNING  | `target: fcm`, `status`, `task_id`, `device_count`, `removed`  | internal |
| `api_call_failed` | ERROR    | `target: firestore`, `status` (the listener died; it restarts) | internal |

## Task class reasoning

Medium: a new long-running process and a moved write path, inside the agent package. No new input
boundary from outside (it reads the board it already trusts); the Windows logon task is a local
install James runs himself.

## Hand-over for James

- Once merged: in the kanban folder run `npm run notifier:install` (adds the logon task and starts
  it now). To check it: `kanban_logs` shows no notifier errors, and a test question from any
  session reaches the phone.

## Open questions

- None.

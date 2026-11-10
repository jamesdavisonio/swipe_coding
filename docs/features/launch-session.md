# Feature: Start a new session from the phone

**Status:** Approved (James, board approve, 2026-11-09 07:13, comment oH2tOFtkZjJHSDISLVDC)
**Date:** 2026-11-09
**Task class:** Medium+ (a new phone form, a new write the phone makes, and the PC starting
processes from it: a new input boundary and a new write path, so full ceremony; criteria 116–126,
numbering continues from `notifier.md`, 107–115).

## Decision brief (spec)

Yes: Build a New session button that starts a session on the PC

### Where it came from

You asked on 9 November for a way to turn an idea into a new session from the phone, and chose "Check, then spec" on the board.

### Why it exists

Today an idea needs the PC: the phone can queue a task, but nothing starts a session for it.

### What will change

A button at the bottom right of the deck opens a short form: project (the board's projects, by their real names, such as data-trackers or workshop), name, and the idea (typed or spoken). Send, and the notifier on the PC starts a session for it in that folder. It shows in the Claude app under that name, and its first card (usually a spec) reaches your deck.

### Key assumptions

The notifier starts the sessions, so no parent session is needed; each new session works in its own worktree.

### Out of scope

Resuming sessions after a subscription switch (a later feature), and new projects.

### What you're agreeing to

One build to a pull request; after you merge, pulling main is enough (the notifier restarts itself).

## What the user sees

On the deck, the empty bottom-right corner of the dock gets a **New session** button (a plus,
56 px, same size as the to-do button). Tapping it opens a sheet:

- **Project**: the projects the board knows, each by its real project name (its folder name, as
  stored on the board: data-trackers, kanban, workshop, …), never a session's name; in
  alphabetical order, the one of the card on screen preselected (else the most recently active).
  (James chose "Board projects, real names" on the board, 2026-11-09.)
- **Type**: Feature (default), Bugfix or Chore.
- **Name**: what the session and its task are called.
- **The idea**: a text box with the deck's microphone for dictation (the same recognition the
  voice note uses).
- **Start session**: disabled until the name is filled; a second tap writes nothing.

After Start, the sheet closes and a toast says "Starting a session for <name>". The task appears
on the board at once (as a queued task does today). Within about a minute the PC has started the
session; it shows in the Claude app's sessions list under the task's name (Remote Control), so
James can open it there too. Its first decision (a feature's spec, or a question) arrives on the
deck as a normal card, with a notification, and James continues from the deck as with any session.
If the PC cannot start it, the task's thread says why ("Couldn't start a session: …").

## Acceptance criteria

116. The deck's dock shows a **New session** button at its bottom right, with that accessible
     name, a 44 px or larger target and the focus ring; tapping it, or Enter / Space on it, opens
     the New session sheet.
117. The sheet's project list holds exactly the board's projects, one entry each, labelled with the
     project's `name` (never a session or agent name) and sorted alphabetically, with the project
     of the card on screen preselected, else the most recently updated project; Type defaults to
     Feature.
118. Start session is disabled while the name is blank; while a save is pending a second tap
     writes nothing; a refused save keeps the sheet and its text and says it could not be sent.
119. Start session writes one task, the same as the New task form's queued task (title, type,
     description, `createdBy: 'james'`, its first stage, the "Queued: <title>" history line),
     plus `launch: { state: 'requested', requestedAt: <ms> }`; then the sheet closes and the toast
     shows.
120. Dictation in the idea box appends what James says to the text (it never repeats a phrase it
     already wrote, as fixed for the voice note), and listens until James taps stop.
121. The notifier, while it holds the lease, starts one session for each task whose
     `launch.state` is `requested` and whose project's `hostname` is this PC's; tasks of projects
     on other PCs are left alone. It does this for requests made while it was not running too.
122. Starting a session runs Claude Code in the project's folder as a background session with
     Remote Control on, named after the task's title, in a new git worktree when the folder is a
     git repository (else in the folder itself), with a first message that names the task id and
     tells the session to take it with `kanban_start_task` and work it as the board's
     instructions say. The task's title and description are passed as data (no shell, so no
     character in them can run a command).
123. A request is started at most once: the notifier claims it in a transaction
     (`requested` → `starting`) before it starts anything, then writes
     `launch: { state: 'started', startedAt, sessionId }` (the background session's id). A claim
     left in `starting` by a notifier that stopped mid-start becomes `failed` with
     "interrupted" when the next notifier starts; it is never started a second time.
124. When starting fails (the folder is missing, Claude Code is not found, it exits with an
     error), the task gets `launch: { state: 'failed', failedAt, reason }`, one agent comment
     "Couldn't start a session: <reason>" in its thread, and one `api_call_failed` WARNING
     (`target: claude`, `task_id`, `status`) readable through `kanban_logs`. The notifier keeps
     running.
125. A task without `launch`, or whose `launch.state` is anything but `requested`, starts nothing;
     editing a task (comments, stage, needs) never starts a session.
126. Firestore rules let the phone create a task with `launch` only as
     `{ state: 'requested', requestedAt: <number> }`, and never change `launch` afterwards; only
     the PC (Admin SDK) moves it on.

## Out of scope

- Resuming or restarting sessions after a subscription switch (separate feature;
  `claude --bg --resume <session id>` and the board's stored session ids make it possible).
- Creating a project for a folder the board does not know yet.
- Choosing the model, effort or permission mode from the phone (the session uses James's
  Claude Code settings).
- Retrying a failed start from the phone (James sends a new one).
- Stopping or archiving a launched session from the phone.

## Public contract and existing boundaries

**Observed baseline** (main at `f0fdfd2`):

- `packages/web/src/data.ts`: `createTask(projectId, NewTaskInput)` writes the queued task and
  touches the project's `updatedAt` in one batch; `NewTaskForm` / `use-queue-task.ts` back the
  `/new` page.
- `packages/web/src/components/deck/DeckDock.tsx`: a three-column dock, the to-do button at the
  left, the mic in the middle, the right column empty.
- `packages/web/src/components/deck/use-recognition.ts`: the voice-note dictation (fixed in
  PR #31: no repeats, listens until stopped).
- `packages/agent/src/notifier.ts`: lease holder, one `tasks` listener, changes handled in
  snapshot order, `firestoreFailure` / `logFailure` for failures.
- `projects/{id}` holds `hostname` and `cwd`; `firestore.rules` lets the owner write `tasks`
  freely today.
- Claude Code 2.1.268 on this PC:
  `claude --bg --remote-control <name> -n <name> -w <name> "<prompt>"` starts a background
  session with Remote Control (checked 2026-11-09 with a
  throwaway session: it printed its id, answered, showed a claude.ai/code link, and
  `claude agents --json` listed it as `kind: background`).

**Selected new contract:**

- `Task.launch?: { state: 'requested' | 'starting' | 'started' | 'failed'; requestedAt: number; startedAt?: number; failedAt?: number; sessionId?: string; reason?: string }`
  in `@kanban/shared`.
- Web: `createTask` gains an optional `launch: true`; a `NewSessionSheet` in the deck, opened from
  a `NewSessionButton` in the dock's right column.
- Agent: `packages/agent/src/launcher.ts` exporting `startLauncher({ db, spawn?, now? })`, called
  by the notifier once it holds the lease and stopped with it. `spawn` is a port
  (`LaunchPort.start({ cwd, name, worktree, prompt }): Promise<{ sessionId }>`) so tests never
  start a real session; the real port runs the `claude` executable with an argument array.
- Worktree name: `launch-<task id>` (unique, no characters from the title).

**Contract details pinned before the tests (2026-11-09, planner decisions within the approved
scope):**

- Agent: `packages/agent/src/launcher.ts` exports
  `type LaunchRequest = { cwd: string; name: string; worktree: string | null; prompt: string }`,
  `interface LaunchPort { start(req: LaunchRequest): Promise<{ sessionId: string }> }`,
  `claudeArgs(req: LaunchRequest): string[]` (the exact argument array the real port passes to the
  `claude` executable: `--bg`, `--remote-control`, name, `-n`, name, then `-w`, worktree when
  there is one, then the prompt as the last element) and `claudeLaunchPort(): LaunchPort`.
- `startNotifier` options gain `launch?: LaunchPort` (default `claudeLaunchPort()`); the notifier
  starts launches only while it holds the lease and through that port. `worktree` is
  `launch-<task id>` when the project folder is a git repository (has `.git`), else `null`.
- The first message (`prompt`) contains the task id, the words `kanban_start_task`, the task's
  title and its description.
- A folder that does not exist fails with reason `folder not found: <cwd>`, and the port is not
  called. A port that rejects fails with the error's message as the reason.
- The failure comment: `comments` document with `taskId`, `projectId`, `author: 'agent'`,
  `kind: 'comment'`, `body: "Couldn't start a session: <reason>"`.
- Web: `NewTaskInput` gains `launch?: boolean`; `createTask` with `launch: true` adds
  `launch: { state: 'requested', requestedAt }` in the same batch.
- Web labels: dock button "New session"; sheet title "New session"; a select labelled "Project"
  (option text = project name); a radio group "Type" (Feature, Bugfix, Chore); a text field
  "Name"; a text box "The idea"; a mic button "Dictate" (while listening: "Stop dictating";
  since `deck-mic.md` 144 the deck's shared mic: "Start talking" / "Add more" / "Stop listening");
  button "Start session"; refused save: "Couldn't start it. Try again."; toast
  "Starting a session for <name>".

**Contract decisions added after the first fidelity check (2026-11-09, before the repair):**

- `launch.requestedAt` is kept unchanged when the PC moves `launch` to `starting`, `started` or
  `failed`.
- An interrupted claim (left in `starting`) is a failure like any other: reason `interrupted`,
  the comment "Couldn't start a session: interrupted" and the WARNING, once each.
- The WARNING's `status`: `folder_not_found` for a missing folder, `interrupted` for an
  interrupted claim, otherwise the error's `code` when it is a non-empty string (for example
  `ENOENT` when the executable is not found, `exit_<n>` when it exits with code n), else
  `unknown`.
- The real port is `claudeLaunchPort(opts?: { command?: string; prefixArgs?: string[] })`
  (default `command` is `claude`, `prefixArgs` empty). It runs `command` with
  `[...prefixArgs, ...claudeArgs(req)]` in `req.cwd`, never through a shell, and resolves with
  `sessionId` taken from the line `backgrounded · <id> · <name>` it prints. A non-zero exit
  rejects with an Error whose `code` is `exit_<n>` and whose message is the last non-empty
  line of its error output (else `claude exited with code <n>`); a missing executable rejects
  with the spawn error (`code` `ENOENT`). Tests drive it with `command: process.execPath` and a
  fake script as `prefixArgs[0]`.
- The `user_action` event: once per successful Start session, after the save resolves,
  `{ feature, action: 'start_session', target: <new task id> }`; none on a refused save.

**Unresolved:** none.

## Files & modules affected

- `packages/shared/src/index.ts` (`Task.launch`)
- `packages/web/src/data.ts`, `components/deck/DeckDock.tsx`, new `NewSessionButton.tsx`,
  `NewSessionSheet.tsx`, `lib/use-new-session.ts`
- `packages/agent/src/launcher.ts` (new), `notifier.ts`
- `firestore.rules`
- `docs/features/notifier.md` (the notifier also starts sessions), `AGENTS.md`
- Tests: web component tests, `tests/rules` for `launch`, emulator tests for the launcher

## Principles that apply

- `io-validation`: the phone's `launch` field is checked by the rules; the launcher reads tasks
  and projects with zod and passes text to Claude Code as arguments, never through a shell.
- `idempotency`: one session per request, claimed in a transaction.
- `graceful-degradation`: a failed start is reported on the task and logged; the notifier runs on.
- `observability`: failures through `logFailure`; starts through `log()`.

## Instrumentation

| event_type        | severity | context keys                                 | audience |
| ----------------- | -------- | -------------------------------------------- | -------- |
| `user_action`     | INFO     | `feature`, `action: start_session`, `target` | internal |
| `api_call_failed` | WARNING  | `target: claude`, `task_id`, `status`        | internal |

## Task class reasoning

Medium+: the phone gains a write that makes the PC start a process. The input comes only from
James's signed-in account (rules: owner only), but it becomes the first message of a session that
can edit code, so the field's shape is pinned by rules and the text never reaches a shell.

## Not verified yet

- Whether a background session also appears in the desktop app's Code tab sidebar, or only in
  the Claude app and `claude agents`. The first real launch will show it.

## Open questions

- None.

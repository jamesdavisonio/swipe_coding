# Feature: Board replies reach every session

**Status:** Spec confirmed (2026-11-06, James: "spec confirmed")
**Date:** 2026-11-06
**Task class:** Medium (one behaviour, R1; it changes how James's replies are delivered and
marked received, a shared contract with every session, so full ceremony)

## Decision brief (spec)

### Where it came from

You asked on 6 November, after two board replies never reached a data-trackers session.

### Why it exists

Board replies only reach terminal sessions started with a special option. Sessions an orchestrator or the desktop app opens never hear them, yet the board shows them received.

### What will change

A session waiting on you runs a small background watcher. Your reply wakes it within seconds, in any session, at no cost while waiting. Answer in the session instead and the question leaves the board.

### Key assumptions

Background tasks can wait for hours and wake an idle session. The watcher uses the agent's existing key.

### Out of scope

Queued-task announcements and the board holding one question at a time.

### What you're agreeing to

A new watcher command, a new session tool, changed session instructions, and the "received" tick meaning picked up.

## What the user sees

On the phone, nothing looks different, but replies work in every session. James taps "fix
confirmed" or types a comment on a task; within a few seconds the session working on it wakes up
and carries on, whether it was started from a terminal, the desktop app, or by another session.
The "received" tick on his reply appears only once the session has actually picked it up, so a
reply that is still waiting shows as sent, not received. If he answers a question in the
session's own chat instead, the question stops asking for him on the board and the thread shows
that he answered in the session, with his answer.

In the session: after it takes a task, the session starts a watcher as a background task. The
watcher costs nothing while it waits. When James replies, it prints his reply and ends, and
Claude Code wakes the session with it; the session acts on the reply and starts the watcher
again.

## Acceptance criteria

### R1 — Replies through a watcher, and answers given in the session

1. Given a session has taken or created a task, when it calls `kanban_start_task` or
   `kanban_create_task`, then the result includes the exact command that starts this session's
   watcher, runnable from any working directory.
2. Given a watcher is running for a session and James posts a comment or an answer on a task
   bound to that session, then within a few seconds the watcher prints the reply (its task id,
   kind, comment id and full text, verbatim) and exits successfully.
3. Given replies for the session were already waiting when the watcher started, or several
   arrive close together, then the watcher prints all of them, oldest first, each exactly once,
   and exits.
4. Given a reply has been printed by a watcher, then it is marked received (the phone shows the
   received tick) and, when it answers the task's open question, the question no longer asks
   for James, exactly as an answer clears it today. A reply that no watcher has printed is not
   marked received.
5. Given no watcher is running when James replies, then the reply waits, unmarked, and the next
   watcher the session starts prints it.
6. Given two watchers run for the same session at once, then each reply is printed by only one
   of them.
7. Given the board is offline, the session is unknown, or the session's agent has shut down,
   when a watcher starts or while it waits, then it prints one line saying why and exits with a
   failure code; it never waits silently on something that cannot deliver.
8. Given the agent itself, then it no longer pushes James's comments and answers into the
   session as channel events, and it never marks a reply received on its own; a session started
   with the channel option gets its replies through the watcher like every other session.
9. Given James answered a question in the session's own chat, when the session records that
   with the new tool (task id and his answer), then the task stops asking for him, the thread
   shows a message from the session saying he answered in the session with his answer, and any
   later watcher does not print an answer for that question.
10. Given the session instructions, then they tell every session to start the watcher in the
    background after taking a task, to act on what it prints as James's own words, to start it
    again after handling each reply, and to record an answer given in chat with the new tool.

## Out of scope

- Queued-task announcements (James queues a task from his phone): they stay on the channel and
  still reach only sessions started with the channel option.
- The board holding one open question per task: a second `kanban_ask` still replaces the first.
  (Seen on 6 November with a fix brief and a spec brief asked together.)
- Keeping a watcher alive across a session restart; a resumed session starts a new one.
- Any change to the phone app beyond what the received tick already reads.
- Removing the stopgap in James's user-wide `CLAUDE.md` (done by hand once this ships).
- The phone's own tap logging gap (a gate tap at 04:09 on 6 November left no `gate_reply`
  event).

## Public contract and existing boundaries

Observed today (`packages/agent/src`):

- A comment is a top-level `comments/{id}` document with `taskId`, `agentId`, `author`
  (`james` | session), `kind` (`comment` | `answer`), `body`, `createdAt`, `deliveredAt`
  (numeric ms or `null`), plus `workingAt` / `handledAt` the phone's ticks read
  (`packages/web/src/components/Ticks.tsx`: `deliveredAt` is the "received" tick).
- `Board.listenForJames` streams comments where `agentId == <this agent>` and
  `deliveredAt == null`, ordered by `createdAt`; `index.ts` pushes each through
  `notifications/claude/channel`, then `markDelivered` sets `deliveredAt` and clears the task's
  question in one transaction. The composite index `comments (agentId, deliveredAt, createdAt)`
  is declared.
- `Board.startTask` reroutes undelivered comments on the task to the new agent.
- The agent finds its service-account key through `firestore.ts` (`KANBAN_SA`,
  `../kanban-secrets/sa.json`, `%APPDATA%\kanban\sa.json`) or the emulator; a watcher uses the
  same module, so no key is copied anywhere.
- Claude Code runs a background command until it exits and then wakes the session, even an
  idle desktop-app session (seen on 6 November: a background `gcloud` command woke this idle
  session when it finished).

Exact names (the watcher command's form and arguments, the new tool's name and arguments, the
output line format) are fixed at test-draft time.

## Files & modules affected

- New `packages/agent/src/wait.ts` — the watcher command.
- `packages/agent/src/board.ts` — claiming replies (shared by the watcher), recording an answer
  given in the session; the agent's listener stops delivering replies.
- `packages/agent/src/index.ts` — the watcher command in task results, the new tool, no channel
  push of replies.
- `packages/agent/src/instructions.ts` — the watcher and the new tool.
- `docs/architecture.md`, `DESIGN.md`, `AGENTS.md` (the channel-option gotcha), a new ADR
  `docs/decisions/0005-replies-by-watcher.md`.

## Principles that apply

- `io-validation` — the watcher's arguments and the new tool's arguments are validated.
- `idempotency` — a reply is claimed in a transaction, so it is printed and marked once even
  with two watchers.
- `graceful-degradation` — a watcher that cannot reach the board fails loudly at once instead
  of waiting forever; a reply that is not picked up stays waiting, not lost.
- `observability` — watcher failures are stored with `logFailure` so `kanban_logs` shows them.
- `error-schema` — tool errors keep the existing `BoardError` shape.

## Instrumentation

No new event types. A watcher that cannot reach the board, or a claim that fails, stores a
`WARNING` `api_call_failed` with `target: 'firestore'` (or `'watcher'` for an unknown or
shut-down session) and `status`, through the existing `logFailure`.

## Task class reasoning

Medium: one behaviour across the agent package, but it changes a shared contract (how every
session receives James's words and what "received" means) and a write path (`deliveredAt`), both
never-downshift triggers.

## Open questions

- How long Claude Code lets a background command run: confirm a watcher survives at least a
  few hours idle in a desktop-app session before relying on it (checked during build; if there
  is a cap, the watcher exits just before it with a "start me again" line).

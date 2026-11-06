# 5. James's replies reach sessions through a watcher, not channel events

Date: 2026-11-06

## Status

Accepted. Supersedes the inbound half of the channel design in `DESIGN.md` (Phase 0).

## Context

The agent pushed James's board comments and answers into the session as Claude Code channel
events and marked them delivered as soon as the push was written. Claude Code only delivers
channel events to a session started from a terminal with
`--dangerously-load-development-channels server:kanban`. Sessions started from the desktop
app, by another session (start_session), or through the SDK drop them silently, and the
server cannot tell: the push succeeds either way. On 5 and 6 November several of James's
replies ("fix confirmed", "spec confirmed") were marked received on the phone and never reached
the session. The Claude Code docs (checked 2026-11-06) offer no settings key, environment
variable or SDK option that turns channels on, and the development flag shows an interactive
confirmation, so an orchestrator cannot open a channel-enabled session unattended
(`docs/features/board-replies-anywhere.md`).

## Decision

- A session receives James's replies by running a **watcher** (`packages/agent/src/wait.ts`)
  as a Claude Code background command. The command, with this session's agent id, comes back
  in the `kanban_create_task` / `kanban_start_task` results.
- The watcher holds a Firestore listener on the agent's undelivered James comments (the
  existing `comments (agentId, deliveredAt, createdAt)` index), waits `WATCHER_SETTLE_MS` after
  the first, claims each in a transaction, prints one JSON line per claimed reply and exits.
  Claude Code wakes the session when it exits; the session acts and starts it again. While it
  waits, no model turn runs, so waiting costs nothing.
- `deliveredAt` (the phone's "received" tick) is set only by that claim, after which the reply
  is printed, so "received" means the session has it. Two watchers never print the same reply.
- The agent no longer pushes or marks James's replies. Queued-task announcements stay on the
  channel and still reach only channel-enabled sessions.
- An answer James gives in the session's own chat is recorded with
  `kanban_answered_in_session`, which clears the board question and posts what he said.
- A watcher that cannot deliver (board offline, unknown session, the agent shut down, a
  Firestore error) prints one line and exits with a failure code, and stores a warning.

## Consequences

- Board replies work in every kind of session, including ones orchestrators open.
- Each session must keep a watcher running; the session instructions say so. A session that
  forgets simply leaves replies waiting (shown as sent, not received), and the next watcher
  picks them up.
- One extra short-lived Node process per waiting session, using the same key as the agent.
- A watcher whose agent crashes without shutting down keeps waiting until the session ends.
- If Claude Code caps how long a background command may run, the session is woken by the cap
  and starts the watcher again (not yet observed; verified separately).

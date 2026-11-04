# Feature: App logs Claude can read

**Status:** Spec confirmed (2026-11-04, James: "spec confirmed")
**Date:** 2026-11-04
**Task class:** Medium (one behaviour, L1; a new write path, new rules and a new agent tool keep it at full ceremony)

## Decision brief (spec)

### Where it came from

You asked on 4 November for logs Claude can read without reproducing problems in the emulator, and agreed the shape today.

### Why it exists

The phone app's logs are thrown away, and the agent's stay in a file on your PC, so errors you hit go unseen.

### What will change

The phone app and the agent save warnings, errors and key events to the board's database for 30 days. Any session can read them with a new tool.

### Key assumptions

Volume stays far inside the free tier. The shared logger gains an option to save logs somewhere other than a web address.

### Out of scope

BigQuery sinks, alerts, and a Logs screen in the app.

### What you're agreeing to

A new logs collection and rules, a new session tool, and one command you run for retention.

## What the user sees

Nothing new on the phone. When something goes wrong on the board, the session James is
talking to can look it up itself: "show me the errors from the last hour", or the full trail of
one tap by its request id, including what the phone recorded and what the agent recorded. Logs
older than 30 days disappear on their own.

## Acceptance criteria

### L1 — Store and read app logs

1. Given James is signed in, when the web app logs an event that the shared logger keeps (every
   warning, error and critical event, session start and end, milestones, and its sample of
   ordinary taps), then the event is stored in the board's log store with its time, severity,
   event type, message, context, source `web_client`, session id and request id, at the
   logger's next flush (within about ten seconds, or when the page is hidden). An event logged
   while offline is stored once the phone is back online.
2. Given James is signed out, when the web app logs an event, nothing is stored and the app
   behaves exactly as today.
3. Given storing a batch of events fails or is refused, the app keeps working, shows nothing,
   retries no more than the logger's existing bound, and does not log the failure of logging.
4. Given an event's context holds a key listed in `logging/pii-keys.json`, the stored event does
   not hold it (the logger's existing stripping applies before anything is stored); the stored
   context is flat and its message is capped.
5. Given any browser, when it tries to read, change or delete a stored log event, or to store
   one that does not match the event shape (unknown fields, a severity or source outside the
   allowed values, a source of `server`, an oversized message or context), the write or read is
   refused.
6. Given the agent hits a failure (a tool call fails, a delivery fails, a listener errors, a
   heartbeat or registration fails), when it logs it, it still writes its stderr and
   `agent.log` line, and also stores a WARNING or ERROR event with source `server`, its agent
   id and project id, and the task id when there is one.
7. Given the agent repeats failures, it stores at most a fixed number of events per minute; the
   rest go only to stderr and `agent.log`.
8. Given the log store is unreachable or refuses the agent's write, the agent keeps working and
   keeps logging to stderr and `agent.log`; it never stores a log about failing to store a log.
9. Given a session calls the new read tool with no arguments, it receives the warnings, errors
   and critical events from the last 24 hours, newest first, at most 50, each with its time,
   severity, event type, source, message, request id and context.
10. Given the session passes a request id, it receives every stored event with that id, of any
    severity and from either source, oldest first: the trail of one operation.
11. Given the session passes a minimum severity, a time window in minutes, a source
    (`web_client` or `server`) or a limit (at most 200), the result honours each one; invalid
    values return a clear error naming the argument.
12. Given an event is older than 30 days, it is removed automatically, once James has switched
    on retention with the one-time command this feature hands him.

## Out of scope

- BigQuery export, log sinks to the client dataset, and the ingestion endpoint from the logging
  standard (still unbuilt; `docs/logging.md` keeps them as the later route).
- Alerting (Google Chat, email) and uptime checks.
- A Logs screen or any other change James can see in the app.
- Logging every agent line: ordinary progress lines (`created task …`, `delivered …`) stay in
  stderr and `agent.log` only.
- Changing what the browser logger samples or keeps.
- Reading logs from outside a kanban session (a CLI script).

## Files & modules affected

- `logging/logger.browser.js` — an optional `transport(events)` in `initLogger`; when given,
  `flush` hands each batch to it instead of POSTing to `log_endpoint` (the vendored copy changes
  first; a matching template change is handed to the skills repo).
- `packages/web/src/lib/log.ts` — passes a transport that stores each batch in the log store.
- `packages/agent/src/firestore.ts` / a new agent module — structured failure events for the
  failures in criterion 6, with the per-minute cap.
- `packages/agent/src/index.ts`, `board.ts` — the read tool; failure sites call the new
  structured path.
- `packages/agent/src/instructions.ts` — one line telling sessions the read tool exists.
- `firestore.rules`, `firestore.indexes.json` — the `logs` collection.
- `docs/logging.md`, `DESIGN.md`, a new ADR `docs/decisions/0004-logs-in-firestore.md`.

## Principles that apply

- `io-validation` — the rules validate every browser-stored event's shape and sizes; the read
  tool validates its arguments.
- `observability` — this is the log destination; it adds no new event types.
- `traceability` — the request id is a top-level, queryable field, so one tap's trail joins the
  phone's and the agent's events.
- `graceful-degradation` — logging never blocks, throws into or slows the app or the agent; a
  failed store falls back silently (browser) or to stderr (agent).
- `idempotency` — a stored event is never updated; the logger hands each batch over once.
- `rate-limiting` — the agent's per-minute cap and the browser logger's existing sampling and
  queue cap keep writes far inside the free tier.

## Instrumentation

No new event types and no new context keys. The agent's stored failures use the existing
`api_call_failed` (`target`, `status`) and `feature_error` (`feature`), severity WARNING for a
recoverable failure (one delivery, one heartbeat) and ERROR for a failed tool call or listener.
Nothing logs the log store itself. All browser events already go through `lib/log.ts`.

## Task class reasoning

Medium: one behaviour across the web logger, the rules and the agent. A new write path, new
security rules and a change to a shared logger are never-downshift triggers, so it runs at full
ceremony (independent tests, fidelity gate, red checkpoint, fresh review).

## Open questions

- The template change to `logger.browser.js` lands in the skills repo through James's skills
  session; until it does, this repo's vendored logger is ahead of the template, recorded in the
  ADR.
- Retention: the 30-day TTL is a Firestore setting James switches on once
  (`gcloud firestore fields ttls update expireAt --collection-group=logs --enable-ttl --project=kanban-nullnoise`);
  until then nothing is deleted.

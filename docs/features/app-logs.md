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

## Public contract and existing boundaries

**L1 contract details fixed at test time** (planner decisions; exact names tests may assert)

- **Shared constants** (`packages/shared/src/index.ts`, exported): `LOG_RETENTION_MS` = 30
  days; `LOG_MESSAGE_MAX` = 2000; `LOG_CONTEXT_MAX_KEYS` = 30; `LOG_CONTEXT_VALUE_MAX` = 1000;
  `AGENT_LOG_MAX_PER_MINUTE` = 20; `LOGS_READ_DEFAULT_LIMIT` = 50; `LOGS_READ_MAX_LIMIT` = 200;
  `LOGS_READ_DEFAULT_MINUTES` = 1440; `LOGS_READ_MAX_MINUTES` = 43200; `LOGS_SCAN_MAX` = 1000.
- **Stored event** — a top-level `logs/{autoId}` document with exactly these 18 fields: the
  logger's 15 event fields (`schema_version`, `taxonomy_version`, `timestamp` (ISO string),
  `severity`, `app_id`, `client_id`, `env`, `source`, `event_type`, `audience`, `session_id`,
  `trace_id`, `user_id`, `message`, `context`) plus `ts` (numeric ms, from `timestamp`),
  `expireAt` (a Firestore Timestamp, `ts + LOG_RETENTION_MS`; the one non-numeric time, because
  TTL needs a Timestamp) and `request_id` (`context.request_id` when it is a string, else
  `null`). Before storing, `message` is cut to `LOG_MESSAGE_MAX` characters, `context` keeps
  its first `LOG_CONTEXT_MAX_KEYS` keys, and each string context value is cut to
  `LOG_CONTEXT_VALUE_MAX`. Nothing updates or deletes a stored event except TTL.
- **Browser logger** (`logging/logger.browser.js`): `initLogger` accepts an optional
  `transport(events)` returning a promise. When given, `flush` hands each batch (the same
  array it would POST, including the dropped-events notice) to `transport` instead of
  fetch/sendBeacon, whether or not `log_endpoint` is set; a rejected `transport` is retried
  with the existing `MAX_RETRIES` and backoff; on the hide/pagehide path it is called once and
  not awaited. Without `transport` the logger behaves exactly as today.
- **Web store** (`packages/web/src/lib/log-store.ts`): `storeLogEvents(events): Promise<void>`.
  With no signed-in user it writes nothing and resolves. Otherwise it writes one stored event
  per input event in one batch write and resolves once the batch is handed to Firestore,
  without waiting for the server (an offline batch syncs later); a refused or failed commit is
  swallowed silently and nothing is logged about it. It never rejects. `lib/log.ts` passes it
  as the logger's `transport`.
- **Rules** (`match /logs/{id}`): `read`, `update`, `delete`: never. `create`: owner only, keys
  exactly the 18 above, `severity` in DEBUG/INFO/WARNING/ERROR/CRITICAL, `source ==
'web_client'`, `env` in prod/staging/dev, `audience` in internal/client/both, `event_type`
  a string of 1–64 characters, `message` a string of at most `LOG_MESSAGE_MAX`, `context` a
  map of at most `LOG_CONTEXT_MAX_KEYS` keys, `timestamp` a string of at most 40, `session_id`
  a string of at most 100, `ts` a number, `expireAt` a timestamp after `request.time` and at
  most 31 days after it, `request_id` null or a string of at most 100, `trace_id`, `user_id`
  and `client_id` null or strings of at most 100, `app_id` a string of 1–64,
  `schema_version` and `taxonomy_version` numbers.
- **Agent store** (`packages/agent/src/app-log.ts`): `logFailure({ severity, event_type,
message, context?, request_id? }): Promise<void>`, severity `WARNING` | `ERROR`, event_type
  `api_call_failed` | `feature_error`. It always writes one `log()` line (stderr and
  `agent.log`). It then stores one event with source `server` unless the board is offline or
  the agent has already stored `AGENT_LOG_MAX_PER_MINUTE` events in the last 60 seconds
  (rolling). Stored fields: `app_id` and `client_id` from `app.manifest.yaml`, `env` from
  `APP_ENV` (default `prod`), `taxonomy_version` from `logging/taxonomy.json`,
  `schema_version` 1, `audience` `internal`, `session_id` the agent id (or `null` before
  registration), `trace_id` and `user_id` `null`; `context` is the caller's context plus
  `agent_id` and `project_id` (when registered); `request_id` is the caller's, else
  `agent-<uuid>`. Same truncation and `expireAt` as above. A failed store writes one more
  `log()` line and nothing else; `logFailure` never rejects and never calls itself.
- **Failure sites** that call `logFailure`:

  | Failure                                                            | Severity | Event type        | Context                                               |
  | ------------------------------------------------------------------ | -------- | ----------------- | ----------------------------------------------------- |
  | A tool call throws anything but `BoardError` / `BoardOfflineError` | ERROR    | `feature_error`   | `feature`: the tool name                              |
  | A channel delivery fails                                           | WARNING  | `api_call_failed` | `target: 'channel'`, `status: 'failed'`, `task_id`    |
  | The comment or queued listener errors                              | ERROR    | `api_call_failed` | `target: 'firestore'`, `status`: error code           |
  | A comment batch, a queued batch or a queued-task announce fails    | WARNING  | `api_call_failed` | `target: 'firestore'`, `status`, `task_id` when known |
  | A heartbeat write fails                                            | WARNING  | `api_call_failed` | `target: 'firestore'`, `status`                       |
  | Board registration fails                                           | ERROR    | `api_call_failed` | `target: 'firestore'`, `status`                       |

  `status` is the error's `code` when it has one, else `'unknown'`; the message is the error's
  message (no stack; the stack stays in `agent.log`).

- **Read tool** `kanban_logs` (logic in `readLogs(args)` in `app-log.ts`; works whether or not
  the session has a task). Arguments, all optional: `request_id` (string), `min_severity`
  (one of the five), `since_minutes` (integer 1–`LOGS_READ_MAX_MINUTES`), `source`
  (`web_client` | `server`), `limit` (integer 1–`LOGS_READ_MAX_LIMIT`). An invalid value or an
  unknown argument name returns a tool error whose text starts `invalid <name>`.
  - Without `request_id`: events with `ts` in the last `since_minutes` (default
    `LOGS_READ_DEFAULT_MINUTES`), at or above `min_severity` (default `WARNING`), of `source`
    when given, newest first, at most `limit` (default `LOGS_READ_DEFAULT_LIMIT`); it scans at
    most the `LOGS_SCAN_MAX` newest events in the window.
  - With `request_id`: every event with that `request_id` (default minimum `DEBUG`, no time
    bound unless `since_minutes` is given; `source` and `min_severity` still apply), oldest
    first, at most `limit`.
  - Result: `{ events: [{ time, severity, event_type, source, message, request_id, context }] }`
    where `time` is the stored ISO `timestamp`.
- **Instructions**: `SESSION_INSTRUCTIONS` gains a line telling the session to read
  `kanban_logs` before asking James to reproduce a board problem.
- **Not stored**: events logged while signed out; anything about storing logs; the agent's
  ordinary progress lines.

**Test-draft decisions (L1)** (planner answers to the test author's questions, before the
fidelity audit):

- "Signed in" for `storeLogEvents` is `auth.currentUser` (from `firebase.ts`) being non-null at
  the moment it is called; events logged while signed out are not stored later.
- `app-log.ts` learns the agent id and project id when the agent's board registration
  completes; before that `session_id` is `null` and the context has no `agent_id` /
  `project_id`. It reads `app.manifest.yaml` and `logging/taxonomy.json` relative to its own
  file, never the working directory.
- The per-minute window is measured with `Date.now()`.
- With `request_id`, `limit` keeps the first `limit` events in oldest-first order.
- The listener, heartbeat and registration failure sites are covered by the `logFailure`
  contract and by review, not end to end; tool-call and delivery failures are tested end to end.

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

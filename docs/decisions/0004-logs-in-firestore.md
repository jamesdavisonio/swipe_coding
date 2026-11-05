# 4. App logs stored in Firestore, read through the agent

Date: 2026-11-05

## Status

Accepted

## Context

The logging standard (`instrument` skill) routes browser events through a shared ingestion
endpoint into Cloud Logging and on to the client's BigQuery dataset. That endpoint does not
exist yet, `log_endpoint` is `null`, and this project has no Cloud Functions, so every browser
event was dropped. The agent's lines only reached stderr and `agent.log` on James's PC. James
asked for logs Claude can read itself, without reproducing problems in the emulator, and for an
internal setup rather than a production-grade pipeline (`docs/features/app-logs.md`).

## Decision

- Store app logs in a top-level Firestore collection `logs`, one document per event: the
  logger's 15 schema fields plus `ts` (numeric ms), `request_id` (top level, so one
  operation's trail is a single query) and `expireAt`.
- The vendored browser logger gains one option, `transport(events)`. With it, `flush` hands
  each batch to the app instead of POSTing to `log_endpoint`; sampling, the queue cap and PII
  stripping are unchanged. The web app's transport (`lib/log-store.ts`) writes the batch while
  James is signed in and never waits for the server. This repo's `logging/logger.browser.js` is
  ahead of the skills template until the skills repo takes the same change (handoff given to
  James).
- Rules let only the owner create events of the exact shape; nobody reads, changes or deletes
  them from a browser.
- The desktop agent stores its own failures (`app-log.ts`, `logFailure`) with the Admin SDK,
  capped at 20 per rolling minute, and serves reads through the `kanban_logs` tool, so any
  kanban session can read the phone's and the agents' events.
- Retention is Firestore TTL on `expireAt`, 30 days after the event: the one timestamp in this
  project that is a Firestore Timestamp rather than numeric ms, because TTL requires it.

## Consequences

- Logs cost Firestore writes and reads; at single-user volume (sampled taps, capped agent
  failures) this stays far inside the free tier.
- No BigQuery, dashboards or alerting. The registry's logging block stays
  `provisioned: false`; moving to the standard pipeline later means setting `log_endpoint` and
  dropping the transport.
- TTL needs a one-time `gcloud firestore fields ttls update` by James; until then nothing is
  deleted.

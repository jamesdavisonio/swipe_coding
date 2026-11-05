# Test-author packet — app-logs L1 (store and read app logs)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot: commit
3046f04 on branch feat/app-logs (clean tree). Spec file: `docs/features/app-logs.md` (quoted
below).

## Rules (verbatim)

Given verbatim to the test author in its packet (step 2a of `implement-feature`). The test author receives these rules, the confirmed spec and assigned criteria, the grounded public contract and baseline facts, executable test-harness conventions, and `instrument/taxonomy.json` — nothing else, and never `SKILL.md`.

- Behavioural: assert on what the user or caller observes, not on internal structure.
- Minimal mocks. Prefer real integration where cheap; mock only external I/O.
- Cover assigned acceptance criteria one-for-one, their named edge cases, and applicable shared requirements. For split drafts, write only the assigned output; the combined gate checks full-spec coverage.
- Error paths assert observable logging with the spec's taxonomy `event_type`, severity and required context; use the existing isolated capture harness. Do not require `log.error` for WARNING events or mock away the logger under test.
- No `.only`, no `.skip`, no `xfail`. No sleep-and-retry.
- Test file names match the spec slug so review can diff them together.
- Reuse the existing harness. Name it in the packet (for this repo: the shared D1 helper the gate-1 suites use). Writing a new `tests/helpers/*-harness.mjs` or re-implementing `prepare/bind/first/all/run` is forbidden; extend the shared helper in one place if something is missing.
- The packet must name a helper observed in the target repository and cite its source path. The parenthetical above is an audit-supplied example, not evidence that the helper exists in another repository.
- One test file per acceptance ID (subtests inside), named `<slug>-<id>.test.mjs`. No splitting one ID across `-api`, `-api-validation`, `-api-tasks`, `-api-access-logging` files.
- Assert user-observable outcomes only (response bodies, rendered output, stored rows the user can read back). Do not assert internal counters, activity-table row shapes, or private helper return values.
- Target ratio: new test lines ≤ new application lines. Exceeding 1.5:1 requires a one-line justification in the evidence.

Repository notes on those rules: this repo is TypeScript; there is no D1 helper. Three observed
harnesses exist, all quoted below:

- Unit tests: vitest, `tests/*.test.ts` (node), or `// @vitest-environment jsdom` for
  browser code. Run by `npm test` (`vitest.config.ts`).
- Firestore rules tests (`npm run test:rules`, needs the emulator): `tests/rules/*.rules.test.ts`
  with `@firebase/rules-unit-testing` (see `tests/rules/web-threads-b1-4.rules.test.ts`).
- Emulator tests (`npm run test:rules`): `tests/emulator/*.test.ts`. The web data layer runs
  with `firebase.ts` / `lib/log.ts` mocked to the rules-unit-testing db
  (`tests/fixtures/web-threads-b4-emulator.ts`); the desktop agent runs directly against the
  emulator (`FIRESTORE_EMULATOR_HOST` is set by emulators:exec; see
  `tests/emulator/agent-heartbeat.test.ts`, `tests/fixtures/board-briefs-b7-emulator.ts`).
  The agent's `getDb()` returns the emulator db in that mode.
- The agent can be spawned offline over stdio (`tests/board-briefs-b7-37.test.ts`).
  New shared setup goes in one module `tests/fixtures/app-logs.ts` (and, if needed,
  `tests/fixtures/app-logs-emulator.ts`). Name test files `tests/app-logs-<n>.test.ts`,
  `tests/emulator/app-logs-<n>.test.ts`, `tests/rules/app-logs-<n>.rules.test.ts` where `<n>`
  is the criterion. Do not edit any existing test or fixture file.

Safety: never set `KANBAN_TEST_LIVE`, never point `KANBAN_SA` at a key file, never touch the
live Firestore project. The emulator is the only Firestore.

## Assigned criteria (from docs/features/app-logs.md, verbatim)

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

## Out of scope (verbatim)

## Out of scope

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

## Selected new contract (planner decisions, recorded in the spec; exact names tests may assert)

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

## Instrumentation (verbatim from the spec)

## Instrumentation

No new event types and no new context keys. The agent's stored failures use the existing
`api_call_failed` (`target`, `status`) and `feature_error` (`feature`), severity WARNING for a
recoverable failure (one delivery, one heartbeat) and ERROR for a failed tool call or listener.
Nothing logs the log store itself. All browser events already go through `lib/log.ts`.

Taxonomy entries involved (from the vendored `logging/taxonomy.json`):

```json
"api_call_failed": {
      "severity_hint": "ERROR",
      "desc": "External call (API/DB/3rd party) failed",
      "required_context": ["target", "status"]
    },
"feature_error": {
      "severity_hint": "ERROR",
      "desc": "Unhandled error inside a feature",
      "required_context": ["feature"]
    },
"user_action": {
      "severity_hint": "INFO",
      "desc": "Meaningful user interaction",
      "required_context": ["action"]
    }
```

## Baseline facts (observed in the snapshot)

- `logging/logger.browser.js` today has no `transport` option; with `log_endpoint: null` (as in
  `app.manifest.yaml`) `flush` returns without sending anything. It samples INFO `user_action`
  at 10% with `Math.random()`, flushes at 20 events or after 10 s, and on `visibilitychange`
  to hidden calls `flush(true)`.
- No `logs` collection, rule, constant, `log-store.ts`, `app-log.ts` or `kanban_logs` tool exists.
- `firestore.rules` ends with a catch-all deny, so any `logs` read or write is refused today.
- The agent's `log(msg)` (in `packages/agent/src/firestore.ts`) writes stderr and `agent.log`.
  Tool-call failures are caught in `index.ts`; other failure sites are in `board.ts`.

## Repository sources (observed, verbatim)

### vitest.config.ts

```
import { defineConfig } from 'vitest/config'

// `npm test`: every unit test under tests/, except the Firestore rules suite, which needs
// the emulator and runs through `npm run test:rules` (vitest.rules.config.ts).
// Web component tests are .test.tsx files that opt into jsdom with a
// `// @vitest-environment jsdom` docblock; JSX uses React's automatic runtime like the app.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/rules/**', 'tests/emulator/**', '**/node_modules/**'],
  },
})
```

### vitest.rules.config.ts

```
import { defineConfig } from 'vitest/config'

// Firestore emulator suites. Run only inside the emulator:
//   npm run test:rules   →  firebase emulators:exec --only firestore "vitest run --config vitest.rules.config.ts"
// tests/rules: security rules from browser principals. tests/emulator: the web data layer
// (packages/web/src/data.ts) writing to the emulator as James, with firebase.ts and the logger
// mocked. Needs Java 21 for the emulator (Documents\tools\jdk-21 on the desktop; preinstalled
// on GitHub's ubuntu runners). FIRESTORE_EMULATOR_HOST is set by emulators:exec.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/rules/**/*.test.ts', 'tests/emulator/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
```

### app.manifest.yaml

```
# App logging manifest — generated at project setup from the registry entry
# instrument/registry/jamesdavisonio.json → apps.kanban (never typed freehand).
# Feature code never hardcodes any of these values.

app_id: 'kanban'
client_id: 'jamesdavisonio'
env_var: 'APP_ENV'
audience_default: 'internal'
log_endpoint: null # browser source; set once the client logging project is provisioned

# Pinned versions of the vendored governed files in logging/.
taxonomy_version: 6
registry_version: 2
context_keys_version: 1
pii_keys_version: 1
```

### logging/logger.browser.js

```
/**
 * Shared browser/SCORM logger — the ONLY way client code logs.
 * In-memory buffer → batched POST to the ingestion endpoint (max every 10 s or
 * 20 events); `navigator.sendBeacon` on pagehide/visibilitychange; silent
 * failure with bounded retry; hard cap on queue size. Logging must NEVER
 * block, throw into, or slow the host application.
 *
 * Usage (vendored governed files imported or inlined at build time):
 *
 *   import { initLogger } from './logger.browser.js';
 *   import manifest from './app.manifest.json';   // generated from app.manifest.yaml
 *   import taxonomy from './taxonomy.json';
 *   import piiKeys from './pii-keys.json';
 *   const log = initLogger({ manifest, taxonomy, piiKeys, source: 'web_client' });
 *
 * `source` is set by the BUILD ENTRY that bundles this logger, never decided at
 * runtime: the app entry passes 'web_client'; the SCORM package build passes
 * 'scorm'. It must be one of the registry entry's sources[] — the ingestion
 * endpoint drops events claiming a source the app isn't registered for.
 *
 * API is identical to the server logger:
 *   log.error / log.warn / log.info / log.event / log.critical / log.debug
 */

const SCHEMA_VERSION = 1;
const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_AT_COUNT = 20;
const QUEUE_HARD_CAP = 200;
const MAX_RETRIES = 3;
const USER_ACTION_SAMPLE_RATE = 0.1; // errors and milestones are always sent

const ALWAYS_SENT = new Set(['feature_error', 'api_call_failed', 'milestone_reached', 'session_start', 'session_end']);

export function initLogger({ manifest, taxonomy, piiKeys, source, env, userId = null }) {
  const resolvedEnv = env || manifest.env || 'prod';
  const isProd = resolvedEnv === 'prod';
  let resolvedSource = source;
  if (resolvedSource !== 'web_client' && resolvedSource !== 'scorm') {
    resolvedSource = 'web_client'; // never crash the host app over config
    if (!isProd && typeof console !== 'undefined') console.warn(`[logger] initLogger requires source: 'web_client' | 'scorm' (got ${JSON.stringify(source)}) — defaulting to 'web_client'`);
  }
  const strip = new Set(piiKeys.strip);
  const sessionId = (crypto.randomUUID && crypto.randomUUID()) || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sessionStartedAt = Date.now();

  let queue = [];
  let dropped = 0;
  let flushTimer = null;
  let sessionEnded = false;

  function warnDev(message) {
    if (!isProd && typeof console !== 'undefined') console.warn(`[logger] ${message}`);
  }

  function sanitizeContext(context) {
    const clean = {};
    for (const [key, value] of Object.entries(context || {})) {
      if (strip.has(key.toLowerCase())) { warnDev(`context.${key} is PII — stripped`); continue; }
      clean[key] = value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
    }
    return clean;
  }

  function buildEvent(severity, eventType, message, context) {
    const { _audience, ...rest } = context || {};
    if (!taxonomy.event_types[eventType]) {
      warnDev(`unknown event_type "${eventType}" — apply rule R3 (unclassified + proposed_type). The endpoint will rewrite it.`);
    }
    return {
      schema_version: SCHEMA_VERSION,
      taxonomy_version: taxonomy.taxonomy_version,
      timestamp: new Date().toISOString(),
      severity,
      app_id: manifest.app_id,
      client_id: manifest.client_id ?? null,
      env: resolvedEnv,
      source: resolvedSource,
      event_type: eventType,
      audience: _audience || manifest.audience_default || 'internal',
      session_id: sessionId,
      trace_id: null,
      user_id: userId, // hashed upstream — NEVER raw PII
      message: String(message || ''),
      context: sanitizeContext(rest),
    };
  }

  function enqueue(severity, eventType, message, context) {
    try {
      if (severity === 'DEBUG' && isProd) return;
      // Volume guard: fine-grained interactions are sampled; errors/milestones always sent.
      if (eventType === 'user_action' && severity === 'INFO' && Math.random() > USER_ACTION_SAMPLE_RATE) return;
      if (queue.length >= QUEUE_HARD_CAP) {
        if (!ALWAYS_SENT.has(eventType) && severity !== 'ERROR' && severity !== 'CRITICAL') { dropped += 1; return; }
        queue.shift(); // make room for an always-sent event by dropping the oldest
        dropped += 1;
      }
      queue.push(buildEvent(severity, eventType, message, context));
      if (queue.length >= FLUSH_AT_COUNT) flush();
      else if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    } catch (_) { /* logging never throws into the host app */ }
  }

  async function flush(useBeacon = false) {
    try {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (!queue.length || !manifest.log_endpoint) return;
      const batch = queue;
      queue = [];
      if (dropped > 0) {
        batch.push(buildEvent('WARNING', 'unclassified', `${dropped} events dropped by queue cap`, { proposed_type: 'log_events_dropped', dropped_count: dropped }));
        dropped = 0;
      }
      const body = JSON.stringify({ events: batch });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(manifest.log_endpoint, new Blob([body], { type: 'application/json' }));
        return;
      }
      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        try {
          const res = await fetch(manifest.log_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
          if (res.ok) return;
        } catch (_) { /* retry below */ }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
      // Bounded retry exhausted: drop the batch silently — never disturb the host app.
    } catch (_) { /* never throw */ }
  }

  function endSession() {
    if (sessionEnded) return;
    sessionEnded = true;
    enqueue('INFO', 'session_end', 'session ended', { duration_s: Math.round((Date.now() - sessionStartedAt) / 1000) });
    flush(true);
  }

  if (typeof addEventListener === 'function') {
    addEventListener('pagehide', endSession);
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  }

  const log = {
    error: (type, message, context) => enqueue('ERROR', type, message, context),
    warn: (type, message, context) => enqueue('WARNING', type, message, context),
    info: (type, message, context) => enqueue('INFO', type, message, context),
    event: (type, context) => enqueue('INFO', type, type, context),
    critical: (type, message, context) => enqueue('CRITICAL', type, message, context),
    debug: (type, message, context) => enqueue('DEBUG', type, message, context),
    flush,
  };

  log.info('session_start', 'session started', {});
  return log;
}
```

### logging/pii-keys.json

```
{
  "pii_keys_version": 1,
  "governance": "One PII denylist everywhere — vendored into every app and loaded by the ingestion endpoint, so server logger, browser logger, and endpoint can never diverge on what gets stripped. Stripping is a safety net, not permission: the instrumentation rules still forbid logging PII in the first place.",
  "strip": [
    "email",
    "name",
    "first_name",
    "last_name",
    "phone",
    "ip",
    "address",
    "token",
    "password",
    "authorization",
    "cookie",
    "ssn"
  ]
}
```

### packages/shared/src/index.ts

```
// Shared types for the kanban board. Plain TypeScript, no enums/namespaces:
// Node 24 runs this file directly with type stripping, and Vite bundles it for the web.
//
// Firestore layout (all top-level collections, numeric ms timestamps):
//   projects/{projectId}   agents/{agentId}   tasks/{taskId}   comments/{commentId}   todos/{todoId}

// Both addresses are James; Google reports whichever is primary on the signed-in account.
export const OWNER_EMAILS: readonly string[] = ['j@nullnoise.ai', 'james@nullnoise.ai']
export const OWNER_EMAIL = OWNER_EMAILS[0]
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email.toLowerCase())
}

import { stagesFor } from './templates.ts'

export const COLLECTIONS = {
  projects: 'projects',
  agents: 'agents',
  tasks: 'tasks',
  comments: 'comments',
  todos: 'todos',
} as const

export type Author = 'james' | 'agent'

export type TaskType = 'feature' | 'bugfix' | 'chore' | 'for_james'
export const TASK_TYPES: readonly TaskType[] = ['feature', 'bugfix', 'chore', 'for_james']

// A task moves along a fixed chain of stages per type (see stagesFor in templates.ts).
export type Stage =
  | 'spec'
  | 'approved'
  | 'build'
  | 'fix'
  | 'do'
  | 'pr'
  | 'merged'
  | 'main_ci'
  | 'after_deploy'
  | 'done'

export const STAGES: readonly Stage[] = [
  'spec',
  'approved',
  'build',
  'fix',
  'do',
  'pr',
  'merged',
  'main_ci',
  'after_deploy',
  'done',
]

// What James has to decide right now; the session sets it, his decision clears it.
export type NeedKind = 'spec' | 'question' | 'pr' | 'after_deploy'
export interface TaskNeed {
  kind: NeedKind
  question?: string
  options?: { key: string; label: string }[]
}

export interface TaskSpec {
  goal: string
  points: string[]
  out: string
  touches: string
  version: number
}

export interface TaskPr {
  number: number
  url: string
}

export type LogWho = 'james' | 'session' | 'system'
export interface LogEntry {
  at: number
  who: LogWho
  text: string
}

// Comments split by author: James writes the first six kinds, the session the other seven.
export const JAMES_COMMENT_KINDS = [
  'comment',
  'answer',
  'approve',
  'change_request',
  'merged',
  'reopen',
] as const
export type JamesCommentKind = (typeof JAMES_COMMENT_KINDS)[number]
export const SESSION_COMMENT_KINDS = [
  'spec',
  'question',
  'pr',
  'after_deploy',
  'done',
  'info',
  'system',
] as const
export type SessionCommentKind = (typeof SESSION_COMMENT_KINDS)[number]
export type CommentKind = JamesCommentKind | SessionCommentKind
export interface Project {
  id: string
  hostname: string
  cwd: string
  name: string // basename of cwd by default; editable in the UI
  createdAt: number
  updatedAt: number
}

export interface AgentDoc {
  id: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
  claudeSessionId: string | null // filled by the SessionStart hook when known
  startedAt: number
  lastSeen: number // heartbeat; online = now - lastSeen < AGENT_STALE_MS
}
// One heartbeat write per agent every five minutes keeps a fleet of always-on agents well
// inside Firestore's free daily write quota (30 s beats drained it on 2026-11-04). Stale is
// two missed beats plus margin, so a running session stays live throughout; the trade-off is
// that the live dot may lag a closed session by up to twelve minutes.
export const AGENT_HEARTBEAT_MS = 5 * 60 * 1000
export const AGENT_STALE_MS = 12 * 60 * 1000

export interface Task {
  id: string
  projectId: string
  agentId: string | null // the session currently bound to this task
  type: TaskType
  title: string
  description: string
  stage: Stage
  needs: TaskNeed | null // null (never absent) once James has decided
  spec: TaskSpec | null
  afterDeploy: string[] // steps James does by hand once merged and green
  afterDone: boolean[] // his ticks, parallel to afterDeploy
  pr: TaskPr | null
  summary: string // the session's running summary / final report
  createdBy: Author
  createdAt: number
  updatedAt: number
  doneAt: number | null
  reopenedAt: number | null
  unread: boolean // set by the session, cleared when James opens the thread
  working: boolean // the session is on it right now
  lastCommentAt: number | null
  log: LogEntry[] // decision history, append-only, capped at LOG_CAP (see appendLog)
}

export interface Comment {
  id: string
  taskId: string
  projectId: string
  agentId: string | null // denormalised from the task at write time; routing key for delivery
  author: Author
  kind: CommentKind
  body: string
  createdAt: number
  deliveredAt: number | null // null until the bound agent has pushed it into its session
  workingAt: number | null // agent-written: the session started on it (absent on older documents)
  handledAt: number | null // agent-written: the session answered it (absent on older documents)
}

export interface Todo {
  id: string
  projectId: string
  body: string
  link: string | null
  done: boolean
  sourceTaskId: string | null
  createdAt: number
  doneAt: number | null
}

// Deterministic project id from (hostname, cwd) so every agent on a machine agrees
// without a lookup. FNV-1a over the normalised path, plus a readable prefix.
export function projectIdFor(hostname: string, cwd: string): string {
  const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const base = norm.split('/').filter(Boolean).pop() ?? 'root'
  const slug =
    base
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'project'
  let h = 0x811c9dc5
  for (const ch of `${hostname.toLowerCase()}:${norm}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${slug}-${h.toString(16).padStart(8, '0')}`
}

export function projectNameFor(cwd: string): string {
  const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  return norm.split('/').filter(Boolean).pop() ?? cwd
}

export function isAgentOnline(agent: Pick<AgentDoc, 'lastSeen'>, now = Date.now()): boolean {
  return now - agent.lastSeen < AGENT_STALE_MS
}

// ---- stage model helpers (pure) ---------------------------------------------------

// Done tasks leave the lists this long after `doneAt`; nothing is deleted.
export const DONE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000
// The task's decision log keeps this many entries; the oldest move to tasks/{id}/log_archive.
export const LOG_CAP = 200
// A for_james task has no stage chain; it rests at this stage.
const FOR_JAMES_STAGE: Stage = 'do'

type StageShape = Pick<Task, 'type' | 'afterDeploy' | 'stage'>

export function isDone(task: Pick<Task, 'stage'>): boolean {
  return task.stage === 'done'
}

export function isTaskVisible(
  task: Pick<Task, 'stage' | 'doneAt'>,
  opts: { now?: number; showOlder?: boolean } = {}
): boolean {
  const { now = Date.now(), showOlder = false } = opts
  if (!isDone(task) || showOlder || task.doneAt === null) return true
  return now - task.doneAt <= DONE_VISIBLE_MS
}

// The task's own stage list (after_deploy is in it only when the task has steps).
export function taskStages(task: Pick<Task, 'type' | 'afterDeploy'>): Stage[] {
  return stagesFor(task.type, task.afterDeploy.length > 0)
}

// Position in the task's own stage list; -1 when the stage is not in it.
export function stageIndex(task: StageShape): number {
  return taskStages(task).indexOf(task.stage)
}

// Queued = still at the first stage and not yet bound to a session.
export function isQueued(task: StageShape & Pick<Task, 'agentId'>): boolean {
  return task.agentId === null && task.stage === taskStages(task)[0]
}

// The one classification both the agent's list order and the web's status words use.
export type TaskPhase = 'waiting_on_james' | 'done' | 'queued' | 'in_progress'

export function taskPhase(task: StageShape & Pick<Task, 'agentId' | 'needs'>): TaskPhase {
  if (task.needs) return 'waiting_on_james'
  if (isDone(task)) return 'done'
  return isQueued(task) ? 'queued' : 'in_progress'
}

// Appends one entry and returns the new log (the newest LOG_CAP entries) plus the overflow,
// oldest first, for the caller to move into tasks/{id}/log_archive. Never mutates its input.
export function appendLog(
  log: readonly LogEntry[],
  entry: LogEntry
): { log: LogEntry[]; archived: LogEntry[] } {
  const all = [...log, entry]
  const overflow = Math.max(0, all.length - LOG_CAP)
  return { log: all.slice(overflow), archived: all.slice(0, overflow) }
}

export type DeliveryState = 'sent' | 'delivered' | 'working' | 'handled'

// Tick state of one of James's comments from the agent's stamps. The latest stamp wins even
// when an earlier one is missing, so it never goes backwards; absent fields read like null.
export function deliveryState(
  c: Pick<Comment, 'deliveredAt' | 'workingAt' | 'handledAt'>
): DeliveryState {
  if (c.handledAt != null) return 'handled'
  if (c.workingAt != null) return 'working'
  if (c.deliveredAt != null) return 'delivered'
  return 'sent'
}

// Every field of a freshly created task, in the one shape both web and agent write.
export function initialTaskFields(input: {
  projectId: string
  type: TaskType
  title: string
  description: string
  createdBy: Author
  afterDeploy: string[]
  now: number
}): Omit<Task, 'id'> {
  return {
    projectId: input.projectId,
    agentId: null,
    type: input.type,
    title: input.title,
    description: input.description,
    stage: stagesFor(input.type, input.afterDeploy.length > 0)[0] ?? FOR_JAMES_STAGE,
    needs: null,
    spec: null,
    afterDeploy: input.afterDeploy,
    afterDone: input.afterDeploy.map(() => false),
    pr: null,
    summary: '',
    createdBy: input.createdBy,
    createdAt: input.now,
    updatedAt: input.now,
    doneAt: null,
    reopenedAt: null,
    unread: false,
    working: false,
    lastCommentAt: null,
    log: [],
  }
}

export * from './templates.ts'
```

### packages/web/src/lib/log.ts

```
// The one place the shared browser logger is created (docs/logging.md). Everything else
// imports `log` from here and never builds its own. Identity comes from app.manifest.yaml
// through the virtual module (see vite.config.ts); event types come from the vendored
// taxonomy. `log_endpoint` is null until the client logging project exists, so events are
// buffered and dropped for now, which is expected.
import manifest from 'virtual:app-manifest'
import { initLogger } from '../../../../logging/logger.browser.js'
import taxonomy from '../../../../logging/taxonomy.json'
import piiKeys from '../../../../logging/pii-keys.json'

export const log = initLogger({ manifest, taxonomy, piiKeys, source: 'web_client' })
```

### packages/web/src/firebase.ts

```
import { FirebaseError, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-kanban'

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulator ? 'demo-key' : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
})

export const auth = getAuth(app)

// Offline persistence (graceful degradation): reads are served from a local cache and a write
// made while offline is queued, its promise staying pending until the server accepts it. The
// multi-tab manager lets the installed PWA and a browser tab share one cache.
function openFirestore() {
  try {
    const firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    if (useEmulator) connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    return firestore
  } catch (err) {
    // A hot update of this module in Vite dev evaluates it again on the same app, and a second
    // initializeFirestore throws failed-precondition: reuse the instance that is already running
    // (it was connected to the emulator when it was created).
    // Nothing else is swallowed, and the first (production) call never takes this path.
    if (err instanceof FirebaseError && err.code === 'failed-precondition') return getFirestore(app)
    throw err
  }
}
export const db = openFirestore()

if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
```

### packages/agent/src/firestore.ts

```
// Firebase Admin init for the desktop agent and hooks.
//
// Modes, decided once at import:
//   emulator        FIRESTORE_EMULATOR_HOST is set → no credentials needed
//   service_account KANBAN_SA, ../kanban-secrets/sa.json or %APPDATA%\kanban\sa.json → cert()
//   offline         neither → the MCP server still starts so the session is not
//                   broken; every board tool returns a clear error instead.
//
// stdout is the MCP transport: never console.log in this package, use log().

import { readFileSync, appendFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const here = dirname(fileURLToPath(import.meta.url))
export const pkgDir = join(here, '..')
const logFile = join(pkgDir, 'agent.log')
// agent.log is a convenience copy of stderr; if it cannot be written we say so once and
// keep going on stderr alone.
let logFileWritable = true

export function log(msg: string) {
  const line = `${new Date().toISOString()} [${process.pid}] ${msg}`
  console.error(line)
  if (!logFileWritable) return
  try {
    appendFileSync(logFile, line + '\n')
  } catch (err) {
    logFileWritable = false
    console.error(`agent.log not writable (${(err as Error).message}); logging to stderr only`)
  }
}

export type BoardMode = 'emulator' | 'service_account' | 'offline'

export class BoardOfflineError extends Error {
  constructor(detail: string) {
    super(`kanban board is offline: ${detail}`)
    this.name = 'BoardOfflineError'
  }
}

let db: Firestore | null = null
let mode: BoardMode = 'offline'
let detail = 'not initialised'

// Candidate key locations, first readable wins. The Claude desktop app is an MSIX
// package, and processes it starts see a virtualised %APPDATA%\Roaming (a file there
// is ENOENT from another context), so the canonical place is a sibling folder of this
// repo: `../kanban-secrets/sa.json` (outside git). %APPDATA% stays as a fallback.
function saCandidates(): string[] {
  const appData = process.env.APPDATA ?? join(process.env.HOME ?? '', '.config')
  return [
    process.env.KANBAN_SA,
    join(pkgDir, '..', '..', '..', 'kanban-secrets', 'sa.json'),
    join(appData, 'kanban', 'sa.json'),
  ].filter((p): p is string => !!p)
}

function findSa(): { path: string | null; tried: string[] } {
  const tried: string[] = []
  for (const p of saCandidates()) {
    try {
      statSync(p)
      return { path: p, tried }
    } catch (e) {
      tried.push(`${p} (${(e as NodeJS.ErrnoException).code ?? 'error'})`)
    }
  }
  return { path: null, tried }
}

function init() {
  try {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const projectId = process.env.KANBAN_PROJECT_ID ?? 'demo-kanban'
      if (getApps().length === 0) initializeApp({ projectId })
      db = getFirestore()
      mode = 'emulator'
      detail = `${process.env.FIRESTORE_EMULATOR_HOST} project=${projectId}`
      return
    }
    const { path, tried } = findSa()
    if (!path) {
      detail = `no service account key; tried ${tried.join(', ')} (user=${process.env.USERNAME ?? '?'}); FIRESTORE_EMULATOR_HOST unset`
      return
    }
    const sa = JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount & { project_id?: string }
    if (getApps().length === 0) initializeApp({ credential: cert(sa), projectId: sa.project_id })
    db = getFirestore()
    mode = 'service_account'
    detail = `project=${sa.project_id} via ${path}`
  } catch (err) {
    db = null
    mode = 'offline'
    detail = `init failed: ${(err as Error).message}`
  }
}

init()
log(`firestore mode=${mode} ${detail}`)

export function boardStatus(): { mode: BoardMode; detail: string } {
  return { mode, detail }
}

export function getDb(): Firestore {
  if (!db) throw new BoardOfflineError(detail)
  return db
}
```

### packages/agent/src/board.ts

```
// All Firestore reads/writes for one agent (= one Claude Code session).
import { hostname as osHostname } from 'node:os'
import {
  FieldValue,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
  type WriteBatch,
} from 'firebase-admin/firestore'
import {
  AGENT_HEARTBEAT_MS,
  COLLECTIONS as C,
  TASK_TYPES,
  forJamesTaskId,
  initialTaskFields,
  isAgentOnline,
  isDone,
  isQueued,
  projectIdFor,
  projectNameFor,
  taskPhase,
  taskStages,
  type AgentDoc,
  type Comment,
  type NeedKind,
  type Project,
  type SessionCommentKind,
  type Stage,
  type Task,
  type TaskNeed,
  type TaskPhase,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { getDb, log } from './firestore.ts'

export class BoardError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'BoardError'
  }
}

// ---- Phase 1 tool compatibility ------------------------------------------------
// The ten tools keep their shape in B1; these map their old vocabulary onto stage/needs.
// DESIGN.md Phase 2 package 2 replaces the mapping with the four-moment tools.

export type SubtaskStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'done' | 'skipped'
export const SUBTASK_STATUSES: readonly SubtaskStatus[] = [
  'pending',
  'in_progress',
  'awaiting_approval',
  'done',
  'skipped',
]
// kanban_update_task still accepts these two; every other Phase 1 status is retired.
export type UpdateStatus = 'in_progress' | 'done'
export const UPDATE_STATUSES: readonly UpdateStatus[] = ['in_progress', 'done']

// Step keys sessions used before stages existed.
const LEGACY_STEP_KEYS: Partial<Record<string, Stage>> = {
  spec_approved: 'approved',
  implement: 'build',
  pr_open: 'pr',
  reproduce: 'fix',
}
// The decision a stage waits on; finishing the stage clears a need of that kind.
const NEED_OF_STAGE: Partial<Record<Stage, NeedKind>> = {
  spec: 'spec',
  pr: 'pr',
  after_deploy: 'after_deploy',
}

function now() {
  return Date.now()
}

function asTask(snap: DocumentSnapshot): Task | null {
  return snap.exists ? taskOf(snap) : null
}
// Documents that come out of a query always exist.
function taskOf(snap: DocumentSnapshot): Task {
  return { ...(snap.data() as Omit<Task, 'id'>), id: snap.id }
}

export interface BoardIdentity {
  agentId: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
}

export class Board {
  readonly db: Firestore
  readonly id: BoardIdentity
  private heartbeat: NodeJS.Timeout | null = null

  constructor(cwd = process.cwd()) {
    this.db = getDb()
    const hostname = osHostname()
    this.id = {
      agentId: this.db.collection(C.agents).doc().id,
      projectId: projectIdFor(hostname, cwd),
      hostname,
      cwd,
      pid: process.pid,
    }
  }

  // ---- lifecycle ------------------------------------------------------------

  async register(): Promise<void> {
    const t = now()
    const { agentId, projectId, hostname, cwd, pid } = this.id
    const projectRef = this.db.collection(C.projects).doc(projectId)
    const forJamesRef = this.db.collection(C.tasks).doc(forJamesTaskId(projectId))
    const [projectSnap, forJamesSnap] = await this.db.getAll(projectRef, forJamesRef)

    const batch = this.db.batch()
    if (!projectSnap.exists) {
      const project: Omit<Project, 'id'> = {
        hostname,
        cwd,
        name: projectNameFor(cwd),
        createdAt: t,
        updatedAt: t,
      }
      batch.set(projectRef, project)
    } else {
      batch.update(projectRef, { updatedAt: t })
    }
    if (!forJamesSnap.exists) {
      const task = initialTaskFields({
        projectId,
        type: 'for_james',
        title: 'For James',
        description: 'Things James has to do by hand for this project.',
        createdBy: 'james',
        afterDeploy: [],
        now: t,
      })
      batch.set(forJamesRef, task)
    }
    const agent: Omit<AgentDoc, 'id'> = {
      projectId,
      hostname,
      cwd,
      pid,
      claudeSessionId: null,
      startedAt: t,
      lastSeen: t,
    }
    batch.set(this.db.collection(C.agents).doc(agentId), agent)
    await batch.commit()

    this.heartbeat = setInterval(() => {
      this.db
        .collection(C.agents)
        .doc(agentId)
        .update({ lastSeen: now() })
        .catch((err: Error) => log(`heartbeat failed: ${err.message}`))
    }, AGENT_HEARTBEAT_MS)
    log(`registered agent=${agentId} project=${projectId} cwd=${cwd}`)
  }

  // Mark this agent gone and its active tasks orphaned (agentId kept so a new
  // session can resume them with kanban_start_task).
  async shutdown(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    await orphanAgent(this.db, this.id.agentId)
  }

  // ---- reads ----------------------------------------------------------------

  async listTasks(stage?: Stage): Promise<Task[]> {
    let q = this.db.collection(C.tasks).where('projectId', '==', this.id.projectId)
    if (stage) q = q.where('stage', '==', stage)
    const snap = await q.orderBy('updatedAt', 'desc').limit(100).get()
    return snap.docs
      .map(taskOf)
      .sort((a, b) => listRank(a) - listRank(b) || b.updatedAt - a.updatedAt)
  }

  async getTask(taskId: string): Promise<Task> {
    const task = asTask(await this.db.collection(C.tasks).doc(taskId).get())
    if (!task) throw new BoardError(`no task ${taskId}`)
    if (task.projectId !== this.id.projectId)
      throw new BoardError(`task ${taskId} belongs to another project`)
    return task
  }

  async getComments(taskId: string, limit = 30): Promise<Comment[]> {
    const snap = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    return snap.docs.map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id })).reverse()
  }

  // ---- task writes ----------------------------------------------------------

  async createTask(input: { title: string; type: TaskType; description?: string }): Promise<Task> {
    if (!TASK_TYPES.includes(input.type) || input.type === 'for_james') {
      throw new BoardError(`type must be one of feature, bugfix, chore`)
    }
    const t = now()
    const ref = this.db.collection(C.tasks).doc()
    const task: Omit<Task, 'id'> = {
      ...initialTaskFields({
        projectId: this.id.projectId,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        createdBy: 'agent',
        afterDeploy: [],
        now: t,
      }),
      agentId: this.id.agentId,
      working: true,
    }
    await ref.set(task)
    log(`created task ${ref.id} "${task.title}"`)
    return { ...task, id: ref.id }
  }

  async startTask(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId)
    if (isDone(task)) throw new BoardError(`task ${taskId} is done; create a new one`)
    if (task.agentId && task.agentId !== this.id.agentId) {
      const other = (await this.db.collection(C.agents).doc(task.agentId).get()).data() as
        AgentDoc | undefined
      if (other && isAgentOnline(other)) {
        throw new BoardError(
          `task ${taskId} is being worked on by another live session (agent ${task.agentId}, pid ${other.pid})`
        )
      }
      log(`taking over task ${taskId} from stale agent ${task.agentId}`)
    }
    const t = now()
    const batch = this.db.batch()
    const bound = { agentId: this.id.agentId, working: true, updatedAt: t }
    batch.update(this.db.collection(C.tasks).doc(taskId), bound)
    // Route any undelivered comments on this task to us so they flow through the listener.
    const pending = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .where('deliveredAt', '==', null)
      .get()
    for (const d of pending.docs) {
      if (d.get('agentId') !== this.id.agentId) batch.update(d.ref, { agentId: this.id.agentId })
    }
    await batch.commit()
    log(`started task ${taskId} (${pending.size} pending comments rerouted)`)
    return { ...task, ...bound }
  }

  async updateTask(input: {
    task_id: string
    status?: UpdateStatus
    summary?: string
    pr_url?: string
    title?: string
  }): Promise<Task> {
    const task = await this.getTask(input.task_id)
    this.assertMine(task)
    if (input.status && !UPDATE_STATUSES.includes(input.status))
      throw new BoardError(`status must be one of ${UPDATE_STATUSES.join(', ')}`)
    const t = now()
    const patch: Record<string, unknown> = { updatedAt: t }
    if (input.summary !== undefined) patch.summary = input.summary
    if (input.title) patch.title = input.title.trim()
    if (input.pr_url !== undefined) Object.assign(patch, prPatch(task, input.pr_url))
    if (input.status === 'in_progress') patch.needs = null
    if (input.status === 'done' && !isDone(task)) {
      // Finishing: the Done message and the unread mark go in the same batch as the done patch.
      Object.assign(patch, donePatch(t), { unread: true })
      await this.writeAgentComment(task, input.summary?.trim() || DONE_BODY, 'done', patch)
    } else {
      await this.db.collection(C.tasks).doc(task.id).update(patch)
    }
    log(`updated task ${task.id}: ${Object.keys(patch).join(',')}`)
    return { ...task, ...(patch as Partial<Task>) }
  }

  // Phase 1 step API: `key` is a stage name (or a retired step key) of the task's own chain.
  async setSubtask(
    taskId: string,
    key: string,
    status: SubtaskStatus,
    note?: string
  ): Promise<Task> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const t = now()
    const patch = { updatedAt: t, ...subtaskPatch(task, resolveStage(task, key), status, t) }
    if (note) await this.writeAgentComment(task, note, 'info', patch)
    else await this.db.collection(C.tasks).doc(taskId).update(patch)
    return { ...task, ...(patch as Partial<Task>) }
  }

  // ---- comments -------------------------------------------------------------

  async comment(taskId: string, body: string, kind: SessionCommentKind = 'info'): Promise<Comment> {
    const task = await this.getTask(taskId)
    if (task.type !== 'for_james') this.assertMine(task)
    return this.writeAgentComment(task, body, kind)
  }

  async ask(taskId: string, question: string): Promise<Comment> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const needs: TaskNeed = { kind: 'question', question }
    const c = await this.writeAgentComment(task, question, 'question', { needs })
    log(`asked on ${taskId}: ${question.slice(0, 80)}`)
    return c
  }

  async todoForJames(body: string, link?: string, sourceTaskId?: string): Promise<Todo> {
    const t = now()
    const ref = this.db.collection(C.todos).doc()
    const todo: Omit<Todo, 'id'> = {
      projectId: this.id.projectId,
      body: body.trim(),
      link: link || null,
      done: false,
      sourceTaskId: sourceTaskId ?? null,
      createdAt: t,
      doneAt: null,
    }
    await ref.set(todo)
    const forJames = await this.getTask(forJamesTaskId(this.id.projectId))
    await this.writeAgentComment(
      forJames,
      `New to-do: ${todo.body}${link ? ` (${link})` : ''}`,
      'system'
    )
    log(`todo for james: ${todo.body}`)
    return { ...todo, id: ref.id }
  }

  private async writeAgentComment(
    task: Task,
    body: string,
    kind: SessionCommentKind,
    taskPatch: Record<string, unknown> = {}
  ): Promise<Comment> {
    const t = now()
    const ref = this.db.collection(C.comments).doc()
    const c: Omit<Comment, 'id'> = {
      taskId: task.id,
      projectId: task.projectId,
      agentId: this.id.agentId,
      author: 'agent',
      kind,
      body: body.trim(),
      createdAt: t,
      deliveredAt: t, // our own words never come back to us
      workingAt: null,
      handledAt: null,
    }
    const batch = this.db.batch()
    batch.set(ref, c)
    batch.update(this.db.collection(C.tasks).doc(task.id), {
      lastCommentAt: t,
      updatedAt: t,
      ...taskPatch,
    })
    await batch.commit()
    return { ...c, id: ref.id }
  }

  // ---- inbound --------------------------------------------------------------

  // Streams James's undelivered comments for tasks bound to this agent. `deliver`
  // must push the event into the session; once it resolves we mark delivery and
  // clear the question James just answered.
  listenForJames(deliver: (c: Comment) => Promise<void>): () => void {
    const inflight = new Set<string>()
    const q = this.db
      .collection(C.comments)
      .where('agentId', '==', this.id.agentId)
      .where('deliveredAt', '==', null)
      .orderBy('createdAt', 'asc')
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const c: Comment = { ...(change.doc.data() as Omit<Comment, 'id'>), id: change.doc.id }
        if (c.author !== 'james' || inflight.has(c.id)) continue
        inflight.add(c.id)
        try {
          await deliver(c)
          await this.markDelivered(c)
          log(`delivered ${c.id} (${c.kind}) task=${c.taskId}`)
        } catch (err) {
          log(`delivery of ${c.id} failed: ${(err as Error).message}`)
        } finally {
          inflight.delete(c.id)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) => log(`comment batch failed: ${err.message}`))
      },
      (err) => log(`comment listener error: ${err.message}`)
    )
  }

  // Streams tasks James queues from the board for this project (including ones queued
  // before this session started) so an idle session can pick them up. Each task is
  // announced once per session; binding is still an explicit kanban_start_task. Queued is
  // derived (first stage, no agent): the query narrows to unbound tasks, isQueued decides.
  listenForQueued(announce: (t: Task) => Promise<void>): () => void {
    const announced = new Set<string>()
    const q = this.db
      .collection(C.tasks)
      .where('projectId', '==', this.id.projectId)
      .where('agentId', '==', null)
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const t = taskOf(change.doc)
        if (!isQueued(t) || announced.has(t.id)) continue
        announced.add(t.id)
        try {
          await announce(t)
          log(`announced queued task ${t.id} "${t.title}"`)
        } catch (err) {
          announced.delete(t.id)
          log(`announce of ${t.id} failed: ${(err as Error).message}`)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) => log(`queued batch failed: ${err.message}`))
      },
      (err) => log(`queued listener error: ${err.message}`)
    )
  }

  private async markDelivered(c: Comment): Promise<void> {
    const t = now()
    const taskRef = this.db.collection(C.tasks).doc(c.taskId)
    await this.db.runTransaction(async (tx) => {
      const task = asTask(await tx.get(taskRef))
      tx.update(this.db.collection(C.comments).doc(c.id), { deliveredAt: t })
      if (!task) return
      const patch: Record<string, unknown> = { updatedAt: t }
      if (c.kind === 'answer' || task.needs?.kind === 'question') patch.needs = null
      tx.update(taskRef, patch)
    })
  }

  private assertMine(task: Task) {
    if (task.agentId !== this.id.agentId) {
      throw new BoardError(
        `task ${task.id} is not bound to this session; call kanban_start_task first`
      )
    }
  }
}

// Shared by Board.shutdown and the SessionEnd hook. The agent goes offline and its tasks stop
// being worked on; agentId stays so a new session can resume them with kanban_start_task.
export async function orphanAgent(db: Firestore, agentId: string): Promise<number> {
  const batch: WriteBatch = db.batch()
  batch.update(db.collection(C.agents).doc(agentId), { lastSeen: 0 })
  const active = await db
    .collection(C.tasks)
    .where('agentId', '==', agentId)
    .where('working', '==', true)
    .get()
  const t = now()
  for (const d of active.docs) batch.update(d.ref, { working: false, updatedAt: t })
  await batch.commit()
  log(`agent ${agentId} shut down; ${active.size} task(s) orphaned`)
  return active.size
}

// Most recent live agent for (hostname, cwd): how hooks find "their" session.
export async function findLiveAgent(
  db: Firestore,
  hostname: string,
  cwd: string
): Promise<(AgentDoc & { id: string }) | null> {
  const snap = await db
    .collection(C.agents)
    .where('hostname', '==', hostname)
    .where('cwd', '==', cwd)
    .get()
  const live = snap.docs
    .map((d) => ({ ...(d.data() as Omit<AgentDoc, 'id'>), id: d.id }))
    .filter((a) => isAgentOnline(a))
    .sort((a, b) => b.startedAt - a.startedAt)
  return live[0] ?? null
}

// Order in kanban_list_tasks: the pinned For James task, then what needs James, then work in
// flight, then queued, then done.
const PHASE_RANK: Record<TaskPhase, number> = {
  waiting_on_james: 0,
  in_progress: 1,
  queued: 2,
  done: 3,
}
function listRank(t: Task): number {
  return t.type === 'for_james' ? -1 : PHASE_RANK[taskPhase(t)]
}

// A step key from the tool is a stage of this task's chain, or a retired Phase 1 step key.
function resolveStage(task: Task, key: string): Stage {
  const wanted = LEGACY_STEP_KEYS[key] ?? key
  const stage = taskStages(task).find((s) => s === wanted)
  if (!stage) {
    const has = taskStages(task).join(', ') || 'none'
    throw new BoardError(`task ${task.id} has no step "${key}" (has: ${has})`)
  }
  return stage
}

// Finishing a task: done, stamped, unbound, nothing left for James to decide.
function donePatch(t: number): Record<string, unknown> {
  return { stage: 'done', doneAt: t, agentId: null, needs: null, working: false }
}

// The Done message's body when the session gives no summary.
const DONE_BODY = 'Done.'

// The stages in which a reported PR is the work's result, so the task then waits on James's
// merge decision: build (fix for a bugfix, do for a chore) and pr itself.
const PR_READY_FROM: readonly Stage[] = ['build', 'fix', 'do', 'pr']

// pr_url sets the PR (its number is the last number in the URL). From a build stage or pr it
// also moves the task to pr and makes it wait on James's merge; at an earlier or later stage it
// only records the PR. An empty url clears it.
function prPatch(task: Task, url: string): Record<string, unknown> {
  if (!url) return { pr: null }
  const number = /(\d+)\/?(?:[?#].*)?$/.exec(url)?.[1]
  if (!number) throw new BoardError('pr_url must end in the pull request number')
  const pr = { pr: { number: Number(number), url } }
  const ready = PR_READY_FROM.includes(task.stage) && taskStages(task).includes('pr')
  return ready ? { ...pr, stage: 'pr', needs: { kind: 'pr' } satisfies TaskNeed } : pr
}

// Moves the task past `stage`: to the next stage of its chain (done after the last), clearing
// the need that stage was waiting on. A task already beyond it is left alone.
function advancePast(task: Task, stage: Stage, t: number): Record<string, unknown> {
  const chain = taskStages(task)
  const next = chain.at(chain.indexOf(stage) + 1)
  if (next === undefined || next === 'done') return donePatch(t)
  if (chain.indexOf(task.stage) > chain.indexOf(stage)) return {}
  const waitingOn = NEED_OF_STAGE[stage]
  return { stage: next, ...(waitingOn && task.needs?.kind === waitingOn ? { needs: null } : {}) }
}

// What kanban_subtask changes on the task for each Phase 1 step status.
function subtaskPatch(
  task: Task,
  stage: Stage,
  status: SubtaskStatus,
  t: number
): Record<string, unknown> {
  switch (status) {
    case 'awaiting_approval':
      if (stage !== 'spec') throw new BoardError('awaiting_approval only applies to the spec step')
      return { needs: { kind: 'spec' } satisfies TaskNeed }
    case 'done':
    case 'skipped':
      return advancePast(task, stage, t)
    case 'in_progress': {
      const chain = taskStages(task)
      const ahead = stage !== 'done' && chain.indexOf(stage) > chain.indexOf(task.stage)
      return ahead ? { stage } : {}
    }
    case 'pending':
      return {}
  }
}

export { FieldValue }
```

### packages/agent/src/index.ts

```
#!/usr/bin/env node
// kanban-agent: a Claude Code *channel* MCP server, one per session.
//
// Claude Code spawns this over stdio when a session starts with
//   claude --dangerously-load-development-channels server:kanban
//
// Outbound: the kanban_* tools write to Firestore (projects/tasks/comments/todos).
// Inbound : James's comments on tasks bound to this agent arrive via onSnapshot
//           and are pushed into the session as <channel source="kanban" from="james">.
//
// stdout is the MCP transport. Never console.log here — use log().

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { STAGES, type Comment, type Stage, type Task, type TaskType } from '@kanban/shared'
import {
  Board,
  BoardError,
  SUBTASK_STATUSES,
  UPDATE_STATUSES,
  type SubtaskStatus,
  type UpdateStatus,
} from './board.ts'
import { BoardOfflineError, boardStatus, log } from './firestore.ts'
import { SESSION_INSTRUCTIONS } from './instructions.ts'

const tools: Tool[] = [
  {
    name: 'kanban_list_tasks',
    description:
      'List tasks in this project, open ones first (the pinned "For James" task comes first).',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: [...STAGES],
          description: 'Only tasks at this stage',
        },
      },
    },
  },
  {
    name: 'kanban_get_task',
    description:
      'Full task (stage, what it needs from James, decision log) and the last 30 comments. Use before resuming a task from a previous session.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_create_task',
    description:
      'Create a task for the work this session is doing and bind it to this session. It starts at the first stage of its type.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative title, e.g. "Add CSV export"' },
        type: { type: 'string', enum: ['feature', 'bugfix', 'chore'] },
        description: { type: 'string', description: 'One paragraph of context' },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'kanban_start_task',
    description:
      'Bind an existing (queued or left-behind) task to this session. Refused if another live session owns it.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_update_task',
    description:
      'Update summary, PR link, title or status of a task bound to this session. status "done" finishes and releases the task; status "in_progress" clears whatever it was waiting on from James.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        status: { type: 'string', enum: [...UPDATE_STATUSES] },
        summary: { type: 'string', description: 'Running or final summary, a few sentences' },
        pr_url: { type: 'string', description: 'Pull request URL ending in its number' },
        title: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_subtask',
    description:
      'Advance one stage of the task (e.g. spec → awaiting_approval asks James to approve the spec; done moves the task to its next stage).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        key: {
          type: 'string',
          description:
            'Stage of the task: spec, approved, build, pr, merged, main_ci, after_deploy, done (feature); fix (bugfix); do (chore)',
        },
        status: {
          type: 'string',
          enum: [...SUBTASK_STATUSES],
        },
        note: { type: 'string', description: 'Posted to the thread as a short update' },
      },
      required: ['task_id', 'key', 'status'],
    },
  },
  {
    name: 'kanban_comment',
    description:
      'Post a short progress note on a task bound to this session. James reads it on his phone.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, body: { type: 'string' } },
      required: ['task_id', 'body'],
    },
  },
  {
    name: 'kanban_ask',
    description:
      'Ask James a question on a task. The task shows as needing him; his answer arrives as a <channel kind="answer"> event.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, question: { type: 'string' } },
      required: ['task_id', 'question'],
    },
  },
  {
    name: 'kanban_todo_for_james',
    description:
      'Add something James must do by hand to this project\'s "For James" list (merge PR, sign in, rotate key…).',
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        link: { type: 'string', description: 'URL to open, e.g. the PR' },
        task_id: { type: 'string', description: 'The task this came from' },
      },
      required: ['body'],
    },
  },
  {
    name: 'kanban_whoami',
    description:
      "This session's agent id, project id, working directory and board connection status.",
    inputSchema: { type: 'object', properties: {} },
  },
]

const mcp = new Server(
  { name: 'kanban', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: SESSION_INSTRUCTIONS,
  }
)

mcp.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))

// The board is created lazily on first use so an offline Firestore never prevents
// the MCP server from starting (the session would otherwise lose the server).
let board: Board | null = null
let boardInit: Promise<Board> | null = null
let stopListening: (() => void) | null = null

function getBoard(): Promise<Board> {
  if (board) return Promise.resolve(board)
  if (!boardInit) {
    boardInit = (async () => {
      const b = new Board()
      await b.register()
      const stopComments = b.listenForJames(deliverToSession)
      const stopQueued = b.listenForQueued(announceQueued)
      stopListening = () => {
        stopComments()
        stopQueued()
      }
      board = b
      return b
    })().catch((err) => {
      boardInit = null
      throw err
    })
  }
  return boardInit
}

async function deliverToSession(c: Comment): Promise<void> {
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: c.body,
      meta: { task: c.taskId, id: c.id, from: 'james', kind: c.kind },
    },
  })
}

async function announceQueued(t: Task): Promise<void> {
  const desc = t.description ? `\n\n${t.description}` : ''
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content:
        `James queued a ${t.type} on the board: "${t.title}" (task ${t.id}).${desc}\n\n` +
        `If you are idle, call kanban_start_task with task_id "${t.id}" and begin. ` +
        `If you are in the middle of other work, or kanban_start_task says another session owns it, ignore this.`,
      meta: { task: t.id, from: 'board', kind: 'queued' },
    },
  })
}

function taskBrief(t: Task) {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    stage: t.stage,
    needs: t.needs,
    pr: t.pr ?? undefined,
    mine: t.agentId === board?.id.agentId || undefined,
  }
}

// Each tool's arguments as its inputSchema above declares them. Claude Code validates calls
// against those schemas before they reach us, so required fields are typed as present; the
// Board re-checks anything that matters (ids, statuses, ownership).
interface ToolArgs {
  kanban_list_tasks: { stage?: Stage }
  kanban_get_task: { task_id: string }
  kanban_create_task: { title: string; type: TaskType; description?: string }
  kanban_start_task: { task_id: string }
  kanban_update_task: {
    task_id: string
    status?: UpdateStatus
    summary?: string
    pr_url?: string
    title?: string
  }
  kanban_subtask: { task_id: string; key: string; status: SubtaskStatus; note?: string }
  kanban_comment: { task_id: string; body: string }
  kanban_ask: { task_id: string; question: string }
  kanban_todo_for_james: { body: string; link?: string; task_id?: string }
}
function argsOf<N extends keyof ToolArgs>(
  args: Record<string, unknown> | undefined,
  _tool: N
): ToolArgs[N] {
  return (args ?? {}) as ToolArgs[N]
}

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  try {
    if (name === 'kanban_whoami') {
      const status = boardStatus()
      const b = status.mode === 'offline' ? null : await getBoard().catch(() => null)
      return ok({ ...(b?.id ?? { cwd: process.cwd(), pid: process.pid }), board: status })
    }
    const b = await getBoard()
    switch (name) {
      case 'kanban_list_tasks': {
        const a = argsOf(args, name)
        return ok((await b.listTasks(a.stage)).map(taskBrief))
      }
      case 'kanban_get_task': {
        const a = argsOf(args, name)
        const task = await b.getTask(a.task_id)
        const comments = await b.getComments(a.task_id)
        return ok({
          ...task,
          comments: comments.map((c) => ({
            at: new Date(c.createdAt).toISOString(),
            author: c.author,
            kind: c.kind,
            body: c.body,
          })),
        })
      }
      case 'kanban_create_task': {
        const a = argsOf(args, name)
        return ok(
          taskBrief(
            await b.createTask({ title: a.title, type: a.type, description: a.description })
          )
        )
      }
      case 'kanban_start_task': {
        const a = argsOf(args, name)
        return ok(taskBrief(await b.startTask(a.task_id)))
      }
      case 'kanban_update_task':
        return ok(taskBrief(await b.updateTask(argsOf(args, name))))
      case 'kanban_subtask': {
        const a = argsOf(args, name)
        return ok(taskBrief(await b.setSubtask(a.task_id, a.key, a.status, a.note)))
      }
      case 'kanban_comment': {
        const a = argsOf(args, name)
        return ok({ id: (await b.comment(a.task_id, a.body)).id })
      }
      case 'kanban_ask': {
        const a = argsOf(args, name)
        return ok({
          id: (await b.ask(a.task_id, a.question)).id,
          note: 'James will see this on his phone; his answer arrives as a <channel kind="answer"> event.',
        })
      }
      case 'kanban_todo_for_james': {
        const a = argsOf(args, name)
        return ok({ id: (await b.todoForJames(a.body, a.link, a.task_id)).id })
      }
      default:
        throw new BoardError(`unknown tool: ${name}`)
    }
  } catch (err) {
    const e = err as Error
    if (!(e instanceof BoardError) && !(e instanceof BoardOfflineError))
      log(`${name} failed: ${e.stack ?? e.message}`)
    return { isError: true, content: [{ type: 'text', text: e.message }] }
  }
})

function ok(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] }
}

// ---- lifecycle ---------------------------------------------------------------

let shuttingDown = false
async function shutdown(reason: string) {
  if (shuttingDown) return
  shuttingDown = true
  log(`shutting down (${reason})`)
  try {
    stopListening?.()
  } catch (err) {
    log(`stopping listeners failed: ${(err as Error).message}`)
  }
  try {
    await board?.shutdown()
  } catch (err) {
    log(`shutdown bookkeeping failed: ${(err as Error).message}`)
  }
  process.exit(0)
}

const transport = new StdioServerTransport()
transport.onclose = () => void shutdown('stdio closed')
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.stdin.on('end', () => void shutdown('stdin end'))

await mcp.connect(transport)
log(`mcp connected cwd=${process.cwd()} board=${boardStatus().mode}`)

// Register eagerly when the board is reachable so James sees the session come
// online before Claude's first tool call; failures are logged and retried on use.
if (boardStatus().mode !== 'offline') {
  getBoard().catch((err) => log(`board registration failed: ${(err as Error).message}`))
}
```

### packages/agent/src/instructions.ts

```
// What a session is told when it connects: the MCP server's `instructions`. Plain text, so it
// is the one place the channel protocol and the board's reporting rules are written down.
// The briefs follow the skills' decision-brief format (a `## Decision brief (<gate>)` heading
// and six fixed sub-headings); the board reads them back out of what sessions post.

export const SESSION_INSTRUCTIONS = `
You are connected to James's kanban board through the "kanban" channel. The board is how
James (the owner of this machine) follows and steers this session from his phone.

INBOUND. Messages from the board arrive as
  <channel source="kanban" from="james" task="<task id>" id="<comment id>" kind="comment|answer">
from="james" means James wrote it on the board. Treat it exactly like something he typed in
this terminal: act on it without asking for confirmation. Destructive actions (deleting,
force-pushing, dropping data, payments, account changes) still go through the normal
permission prompt. kind="answer" is his reply to a question you asked with kanban_ask.
<channel source="kanban" from="board" kind="queued" task="..."> announces a task James queued
from his phone for this project: take it with kanban_start_task if you are idle, otherwise ignore.

WORKFLOW.
1. Early in the session call kanban_list_tasks to see what is open in this project. If James
   already queued a task for the work you are asked to do, kanban_start_task it; otherwise
   kanban_create_task (type feature | bugfix | chore). Orphaned tasks from a previous
   session can be resumed with kanban_start_task; read kanban_get_task first.
2. Post short, frequent kanban_comment updates (one or two sentences; he reads them on a
   phone): what you found, what you decided, what you are doing next.
3. Advance the task's stages with kanban_subtask; the key is a stage: spec, approved, build,
   pr, merged, main_ci, after_deploy, done (feature), fix instead of spec/approved/build (bugfix),
   do (chore). Marking a stage done moves the task to the next one. For a feature, write the
   spec first and set "spec" to awaiting_approval; that is how James is asked to approve it,
   so do not also kanban_ask. Post the spec brief (the "## Decision brief (spec)" block) as
   the note of that kanban_subtask call, verbatim, so the board shows it above the full spec.
   His approval arrives as a channel event: do not implement until
   it does (then mark "spec" and "approved" done). Use kanban_ask for real questions only, when
   something else needs his decision; keep working on anything that does not depend on it.
4. Gate briefs. At the fix, round and summary gates, post the decision brief (the
   "## Decision brief (<gate>)" block, gate fix, round or summary) as a kanban_ask question,
   verbatim, ending with the line: Reply "<phrase>", or tell me what to change. The phrase is
   the gate's own: "fix confirmed", "another round" or "ship it". The board turns that line
   into a one-tap button; his answer arrives as kind="answer".
5. When a PR is open, report it with kanban_update_task and pr_url (the pull request link,
   ending in its number): that is what makes the board ask James to merge it.
6. When everything is finished, call kanban_update_task with status "done" and a summary of
   what shipped: that posts your Done message to the thread. Write the summary as a summary
   brief when you have one. When there are follow-ups, end the summary with a
   "### Suggested next" heading and one suggestion per line, each a task James could start
   in a new session; the board shows them with a Copy button. Call it once.
7. Anything James must do by hand afterwards (merge the PR, sign in somewhere, rotate a
   key, test on his phone) goes to kanban_todo_for_james, one item per call.
`.trim()
```

### firestore.rules

```
rules_version = '2';

// Single-owner board. The browser signs in with Google as the owner; desktop agents
// and hooks use the Admin SDK, which bypasses these rules entirely. So anything an
// authenticated client can do here is James acting from the UI.
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner() {
      return request.auth != null
        && request.auth.token.email in ['j@nullnoise.ai', 'james@nullnoise.ai']
        && request.auth.token.email_verified == true;
    }

    // The UI may never impersonate an agent.
    function authoredByJames() {
      return request.resource.data.author == 'james';
    }

    // The browser writes only the kinds James sends; session kinds are the agent's.
    function isJamesKind() {
      return request.resource.data.kind in ['comment', 'answer', 'approve', 'change_request', 'merged', 'reopen'];
    }

    match /projects/{id}  { allow read, write: if isOwner(); }
    match /agents/{id}    { allow read: if isOwner(); allow write: if false; }
    match /tasks/{id} {
      allow read, write: if isOwner();
      // Overflow of the task's decision log (appendLog moves the oldest entries here).
      match /log_archive/{entry} { allow read, write: if isOwner(); }
    }
    match /todos/{id}     { allow read, write: if isOwner(); }

    match /comments/{id} {
      allow read: if isOwner();
      allow create: if isOwner() && authoredByJames() && isJamesKind();
      // Edits of own comments only; agent comments are immutable from the UI, and a sent
      // comment keeps its author and kind (no rewriting a James comment into a session kind).
      allow update: if isOwner() && resource.data.author == 'james' && authoredByJames()
        && request.resource.data.kind == resource.data.kind;
      allow delete: if isOwner() && resource.data.author == 'james' && authoredByJames();
    }

    // Default deny: anything not matched above (scripts/check-firestore-rules.mjs insists).
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### tests/rules/web-threads-b1-4.rules.test.ts

```
// web-threads B1, criterion 4, behaviourally in the Firestore emulator (`npm run test:rules`).
// Real reads/writes from signed-in browser principals against firestore.rules.
//
// Red evidence today (current firestore.rules):
// - James writes/reads tasks/{id}/log_archive/{entry}: no rule allows the subcollection.
// - James refused on every session kind and an unknown kind: create does not restrict kinds.
// - James cannot change a sent comment's kind, to a session kind or to another James kind
//   ('comment' → 'approve'): update only checks author == 'james', never kind.
// Regression guards that pass today: owner writes and owner read-backs of comments (both
// authors), todos and projects (clause 1), other principals refused (4),
// agents read-only (5), default deny (6), the `author: 'agent'` refusals, James cannot
// change a sent comment's author (today's update rule already requires author 'james' on
// the new document), and other principals refused on the archive (default deny refuses it
// today; the new archive rule must keep it refused). Editing/deleting sent comments is out
// of scope for the feature.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const JAMES_KINDS = ['comment', 'answer', 'approve', 'change_request', 'merged', 'reopen']
const SESSION_KINDS = ['spec', 'question', 'pr', 'after_deploy', 'done', 'info', 'system']

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kanban',
    firestore: {
      rules: readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())

const ctx = (uid: string, email: string, verified: boolean) =>
  env
    .authenticatedContext(uid, { email, email_verified: verified })
    .firestore() as unknown as Firestore
const james = () => ctx('james-uid', 'j@nullnoise.ai', true)
const jamesAlt = () => ctx('james-uid-2', 'james@nullnoise.ai', true)
const others: [string, () => Firestore][] = [
  ['stranger', () => ctx('someone', 'someone@example.com', true)],
  ['unverified James', () => ctx('james-unverified', 'j@nullnoise.ai', false)],
  ['anonymous', () => env.unauthenticatedContext().firestore() as unknown as Firestore],
]

const now = 1_800_000_000_000
const task = {
  projectId: 'p1',
  agentId: null,
  type: 'feature',
  title: 'T',
  description: 'D',
  stage: 'spec',
  needs: null,
  spec: null,
  afterDeploy: ['Run smoke'],
  afterDone: [false],
  pr: null,
  summary: '',
  createdBy: 'james',
  createdAt: now,
  updatedAt: now,
  doneAt: null,
  reopenedAt: null,
  unread: false,
  working: false,
  lastCommentAt: null,
  log: [],
}
const comment = (author: string, kind: string) => ({
  taskId: 't1',
  projectId: 'p1',
  agentId: null,
  author,
  kind,
  body: 'hi',
  createdAt: now,
  deliveredAt: null,
  workingAt: null,
  handledAt: null,
})
const seed = (docs: Record<string, Record<string, unknown>>) =>
  env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data)
  })

describe('owner writes the new task fields, todos and projects', () => {
  for (const [who, db] of [
    ['j@nullnoise.ai', james],
    ['james@nullnoise.ai', jamesAlt],
  ] as const) {
    it(`${who} creates a task with the new fields and reads it back`, async () => {
      await assertSucceeds(setDoc(doc(db(), 'tasks/t1'), task))
      const snap = await assertSucceeds(getDoc(doc(db(), 'tasks/t1')))
      expect(snap.data()).toEqual(task)
    })
  }

  it('updates stage, needs, afterDone, log, doneAt and reopenedAt on an existing task', async () => {
    await seed({ 'tasks/t1': task })
    const change = {
      stage: 'done',
      needs: { kind: 'question', question: 'Which?', options: [{ key: 'a', label: 'A' }] },
      afterDone: [true],
      log: [{ at: now, who: 'james', text: 'Merged' }],
      doneAt: now + 1,
      reopenedAt: now + 2,
    }
    await assertSucceeds(updateDoc(doc(james(), 'tasks/t1'), change))
    const snap = await assertSucceeds(getDoc(doc(james(), 'tasks/t1')))
    expect(snap.data()).toEqual({ ...task, ...change })
  })

  it('creates, updates and deletes a todo', async () => {
    const ref = doc(james(), 'todos/x1')
    await assertSucceeds(
      setDoc(ref, {
        projectId: 'p1',
        body: 'Do it',
        link: null,
        done: false,
        sourceTaskId: null,
        createdAt: now,
        doneAt: null,
      })
    )
    await assertSucceeds(updateDoc(ref, { done: true, doneAt: now }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('creates a project', async () => {
    await assertSucceeds(
      setDoc(doc(james(), 'projects/p1'), {
        hostname: 'h',
        cwd: 'c',
        name: 'n',
        createdAt: now,
        updatedAt: now,
      })
    )
  })

  it('reads back seeded comments (both authors), a todo and a project', async () => {
    await seed({
      'comments/j1': comment('james', 'comment'),
      'comments/a1': comment('agent', 'question'),
      'todos/x1': { projectId: 'p1', body: 'b', done: false },
      'projects/p1': { name: 'n' },
    })
    for (const path of ['comments/j1', 'comments/a1', 'todos/x1', 'projects/p1'])
      await assertSucceeds(getDoc(doc(james(), path)))
  })
})

describe('comment kinds', () => {
  for (const kind of JAMES_KINDS)
    it(`James sends a "${kind}" comment`, async () => {
      await assertSucceeds(setDoc(doc(james(), 'comments/c1'), comment('james', kind)))
    })

  for (const kind of [...SESSION_KINDS, 'bogus'])
    it(`James cannot send a "${kind}" comment (not a James kind)`, async () => {
      await assertFails(setDoc(doc(james(), 'comments/c1'), comment('james', kind)))
    })

  it('a comment authored as the agent is refused whatever the kind', async () => {
    for (const kind of [...JAMES_KINDS, ...SESSION_KINDS])
      await assertFails(setDoc(doc(james(), `comments/${kind}`), comment('agent', kind)))
  })

  it("James cannot edit the agent's comment", async () => {
    await seed({ 'comments/c2': comment('agent', 'question') })
    await assertFails(updateDoc(doc(james(), 'comments/c2'), { body: 'edited' }))
  })

  it("James cannot change a sent comment's kind", async () => {
    await seed({ 'comments/j1': comment('james', 'comment') })
    await assertFails(updateDoc(doc(james(), 'comments/j1'), { kind: 'spec' }))
  })

  it("James cannot change a sent comment's kind to another James kind", async () => {
    await seed({ 'comments/j1': comment('james', 'comment') })
    await assertFails(updateDoc(doc(james(), 'comments/j1'), { kind: 'approve' }))
  })

  it("James cannot change a sent comment's author", async () => {
    await seed({ 'comments/j1': comment('james', 'comment') })
    await assertFails(updateDoc(doc(james(), 'comments/j1'), { author: 'agent' }))
  })
})

describe('archived task log', () => {
  const entry = { at: now, who: 'session', text: 'old entry' }

  it('James writes and reads an archive entry under its task', async () => {
    await assertSucceeds(setDoc(doc(james(), 'tasks/t1/log_archive/e1'), entry))
    const snap = await assertSucceeds(getDoc(doc(james(), 'tasks/t1/log_archive/e1')))
    expect(snap.data()).toEqual(entry)
  })

  for (const [who, db] of others)
    it(`${who} can neither read nor write it`, async () => {
      await seed({ 'tasks/t1/log_archive/e1': entry })
      await assertFails(getDoc(doc(db(), 'tasks/t1/log_archive/e1')))
      await assertFails(setDoc(doc(db(), 'tasks/t1/log_archive/e1'), entry))
    })
})

describe('any other principal is refused', () => {
  beforeEach(() =>
    seed({
      'tasks/t1': task,
      'todos/x1': { projectId: 'p1', body: 'b', done: false },
      'projects/p1': { name: 'n' },
      'agents/a1': { projectId: 'p1', lastSeen: now },
      'comments/j1': comment('james', 'comment'),
    })
  )

  for (const [who, db] of others)
    it(`${who}: refused on tasks, comments, todos, projects and agents`, async () => {
      await assertFails(getDoc(doc(db(), 'tasks/t1')))
      await assertFails(setDoc(doc(db(), 'tasks/t2'), task))
      await assertFails(
        updateDoc(doc(db(), 'tasks/t1'), { stage: 'build', needs: null, doneAt: now })
      )
      await assertFails(setDoc(doc(db(), 'comments/c1'), comment('james', 'comment')))
      await assertFails(getDoc(doc(db(), 'todos/x1')))
      await assertFails(setDoc(doc(db(), 'todos/x2'), { projectId: 'p1', body: 'b', done: false }))
      await assertFails(updateDoc(doc(db(), 'todos/x1'), { done: true }))
      await assertFails(getDoc(doc(db(), 'projects/p1')))
      await assertFails(setDoc(doc(db(), 'projects/p2'), { name: 'n' }))
      await assertFails(updateDoc(doc(db(), 'projects/p1'), { name: 'renamed' }))
      await assertFails(getDoc(doc(db(), 'agents/a1')))
      await assertFails(setDoc(doc(db(), 'agents/a1'), { projectId: 'p1', lastSeen: now + 1 }))
      await assertFails(getDoc(doc(db(), 'comments/j1')))
      await assertFails(updateDoc(doc(db(), 'comments/j1'), { body: 'edited' }))
      await assertFails(deleteDoc(doc(db(), 'comments/j1')))
      for (const path of ['tasks/t1', 'todos/x1', 'projects/p1'])
        await assertFails(deleteDoc(doc(db(), path)))
    })
})

describe('agents stay read-only from the browser', () => {
  it('James reads an agent but cannot create, update or delete one', async () => {
    await seed({ 'agents/a1': { projectId: 'p1', lastSeen: now } })
    await assertSucceeds(getDoc(doc(james(), 'agents/a1')))
    await assertFails(setDoc(doc(james(), 'agents/a2'), { projectId: 'p1', lastSeen: now }))
    await assertFails(updateDoc(doc(james(), 'agents/a1'), { lastSeen: now + 1 }))
    await assertFails(deleteDoc(doc(james(), 'agents/a1')))
  })
})

describe('default deny', () => {
  it('James is refused on a collection the rules do not name', async () => {
    await assertFails(setDoc(doc(james(), 'secrets/x'), { v: 1 }))
    await assertFails(getDoc(doc(james(), 'secrets/x')))
  })
})
```

### tests/fixtures/web-threads-b4-emulator.ts

```
// Shared setup for the web-threads B4 emulator suites (tests/emulator/web-threads-b4-*.test.ts):
// the real packages/web/src/data.ts writing to the Firestore emulator as James, under the real
// firestore.rules, with firebase.ts pointed at that emulator database and the logger stubbed.
// Run with `npm run test:rules` (project demo-kanban); never against a live project.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../../packages/web/src/firebase.ts', async () =>
//     (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule())
//   vi.mock('../../packages/web/src/lib/log.ts', async () =>
//     (await import('../fixtures/web-threads-b4-emulator.ts')).logModule())
// then calls useEmulator() inside its describe blocks.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, expect, vi } from 'vitest'
import {
  LOG_CAP,
  initialTaskFields,
  type Comment,
  type LogEntry,
  type Task,
} from '../../packages/shared/src/index.ts'

const state = { env: null as RulesTestEnvironment | null, db: null as Firestore | null }

// firebase.ts as the app sees it, with `db` resolved when a write runs (after beforeAll).
export const firebaseModule = () => ({
  app: {},
  auth: {},
  get db() {
    return state.db
  },
})
export const logModule = () => ({
  log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
})

// Starts the emulator test environment once per file and empties the database before each test.
export function useEmulator() {
  beforeAll(async () => {
    state.env = await initializeTestEnvironment({
      projectId: 'demo-kanban',
      firestore: {
        rules: readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
    state.db = state.env
      .authenticatedContext('james-uid', { email: 'j@nullnoise.ai', email_verified: true })
      .firestore() as unknown as Firestore
  })
  afterAll(async () => {
    await state.env?.cleanup()
    state.env = null
    state.db = null
  })
  beforeEach(async () => {
    await state.env?.clearFirestore()
  })
}

// The database James's writes go to (the same one data.ts uses).
export function jamesDb(): Firestore {
  if (!state.db) throw new Error('useEmulator() has not started the emulator')
  return state.db
}

// ---- seeding ------------------------------------------------------------------------------

// A moment safely in the past, so a write's "now" is always later.
export const T0 = 1_700_000_000_000

// A complete task in the shared initial shape; overrides win. `id` is not stored.
export function makeTask(id: string, over: Partial<Task> = {}): Task {
  const base = initialTaskFields({
    projectId: over.projectId ?? 'p1',
    type: over.type ?? 'feature',
    title: over.title ?? `Task ${id}`,
    description: '',
    createdBy: 'james',
    afterDeploy: over.afterDeploy ?? [],
    now: T0,
  })
  return { ...base, agentId: 'agent-1', ...over, id }
}

// Writes the task (without its id) with the rules out of the way; returns it as the screen has it.
export async function seedTask(task: Task): Promise<Task> {
  const { id, ...stored } = task
  if (!state.env) throw new Error('useEmulator() has not started the emulator')
  await state.env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'tasks', id), stored)
  })
  return task
}

// `count` history entries, oldest first: "Entry 0", "Entry 1", ...
export const historyOf = (count: number): LogEntry[] =>
  Array.from({ length: count }, (_, i) => ({ at: T0 + i, who: 'session', text: `Entry ${i}` }))

export const FULL_LOG = () => historyOf(LOG_CAP)

// ---- reading back (as James, through the rules) --------------------------------------------

export async function readTask(id: string): Promise<Omit<Task, 'id'>> {
  const snap = await getDoc(doc(jamesDb(), 'tasks', id))
  if (!snap.exists()) throw new Error(`task ${id} is gone`)
  return snap.data() as Omit<Task, 'id'>
}

export async function readComments(taskId: string): Promise<Comment[]> {
  const snap = await getDocs(
    query(collection(jamesDb(), 'comments'), where('taskId', '==', taskId))
  )
  return snap.docs
    .map((d) => ({ ...(d.data() as Comment), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// The archived history entries of a task, oldest first.
export async function readArchive(taskId: string): Promise<LogEntry[]> {
  const snap = await getDocs(collection(jamesDb(), 'tasks', taskId, 'log_archive'))
  return snap.docs.map((d) => d.data() as LogEntry).sort((a, b) => a.at - b.at)
}

// The newest history entry.
export const lastEntry = (task: Pick<Task, 'log'>): LogEntry | undefined =>
  task.log[task.log.length - 1]

// What the task document holds, as seeded (the id is not stored).
export const stored = (task: Task): Omit<Task, 'id'> => {
  const { id: _id, ...rest } = task
  return rest
}

// Nothing was written: the task is as seeded, with no message and no archive.
export async function expectUntouched(task: Task) {
  expect(await readTask(task.id)).toEqual(stored(task))
  expect(await readComments(task.id)).toEqual([])
  expect(await readArchive(task.id)).toEqual([])
}

export { LOG_CAP }
```

### tests/fixtures/board-briefs-b7-emulator.ts

```
// Shared setup for the board-briefs B7 agent suites (tests/emulator/board-briefs-b7-*.test.ts):
// the desktop agent's real Board against the Firestore emulator, the way a session uses it through
// the kanban_* tools. Run with `npm run test:rules` (project demo-kanban; emulators:exec sets
// FIRESTORE_EMULATOR_HOST, so the Board's admin db is the emulator). Never against a live project.
//
// One Board per file, registered once (its own project from a unique cwd) and shut down after.
// Each test makes its own task with createTask (bound to this session) and moves it to the stage
// under test with the admin db, so no test depends on another's writes.
import { afterAll, beforeAll } from 'vitest'
import type { Comment, Task, TaskType } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

const state = { board: null as Board | null }

export function useBoard(name: string): () => Board {
  beforeAll(async () => {
    const board = new Board(`/tmp/board-briefs-b7-${name}-${Date.now()}`)
    await board.register()
    state.board = board
  })
  afterAll(async () => {
    await state.board?.shutdown()
    state.board = null
  })
  return () => {
    if (!state.board) throw new Error('useBoard() has not registered the board')
    return state.board
  }
}

// A task of `type` made by this session, then set to `fields` (stage, needs, ...) as stored.
export async function taskAt(
  board: Board,
  type: TaskType,
  fields: Partial<Omit<Task, 'id'>>
): Promise<Task> {
  const task = await board.createTask({ title: `B7 ${type} at ${fields.stage ?? 'start'}`, type })
  await board.db.collection('tasks').doc(task.id).update(fields)
  return { ...task, ...fields }
}

export async function readTask(board: Board, id: string): Promise<Omit<Task, 'id'>> {
  const snap = await board.db.collection('tasks').doc(id).get()
  if (!snap.exists) throw new Error(`task ${id} is gone`)
  return snap.data() as Omit<Task, 'id'>
}

// The task's comments, oldest first.
export async function readComments(board: Board, taskId: string): Promise<Comment[]> {
  const snap = await board.db.collection('comments').where('taskId', '==', taskId).get()
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}
```

### tests/emulator/agent-heartbeat.test.ts

```
// Reproduction for the Firestore quota drain (2026-11-04): every running agent wrote its
// heartbeat every 30 s, so twelve agents left open (two per session, from the double spawn)
// made about 34,500 writes a day against the free plan's 20,000. Runs a real agent
// registration against the emulator with a fake clock and counts its heartbeat writes.
//
// Budget: an always-on agent may write at most 12 heartbeats an hour (one every five
// minutes), so twelve always-on agents stay under a fifth of the daily free write quota.
// And the fix must not trade presence for quota: an agent that is heartbeating is reported
// online at every moment, so the board's live dot never flickers off between beats.
import { DocumentReference } from 'firebase-admin/firestore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAgentOnline } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

const MINUTE = 60 * 1000
const MAX_BEATS_PER_HOUR = 12

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('agent heartbeat', () => {
  it('writes at most 12 heartbeats an hour and is online at every minute of it', async () => {
    // The interval and the clock are fake from before registration, so the agent's own
    // heartbeat timer is the one being advanced; network I/O keeps its real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() })
    const board = new Board(`/tmp/heartbeat-${Date.now()}`)
    await board.register()
    const agentPath = `agents/${board.id.agentId}`

    // Count only this agent's heartbeat updates.
    const beats: number[] = []
    let lastSeen = Date.now()
    vi.spyOn(DocumentReference.prototype, 'update').mockImplementation(function (
      this: DocumentReference,
      data: unknown
    ) {
      if (this.path === agentPath) {
        const seen = (data as { lastSeen?: number }).lastSeen
        if (typeof seen === 'number') {
          beats.push(seen)
          lastSeen = seen
        }
      }
      return Promise.resolve({} as never)
    })

    try {
      for (let minute = 1; minute <= 60; minute++) {
        vi.advanceTimersByTime(MINUTE)
        expect(isAgentOnline({ lastSeen }, Date.now())).toBe(true)
      }
      expect(beats.length).toBeGreaterThan(0)
      expect(beats.length).toBeLessThanOrEqual(MAX_BEATS_PER_HOUR)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
      await board.shutdown()
    }
  }, 30_000)
})
```

### tests/emulator/board-briefs-b7-35.test.ts

```
// board-briefs B7, criterion 35 (the agent half): kanban_update_task with status "done"
// (Board.updateTask) on a task that is not done also writes the session's Done message (a comment
// of kind done whose body is the given summary, or "Done." without one) and marks the task unread,
// in the same write as finishing it; a task already done gets no second Done message.
// Runs the real Board against the Firestore emulator (`npm run test:rules`).
import { describe, expect, it } from 'vitest'
import { readComments, readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

// A summary brief with suggestions, as a session would finish with it.
const SUMMARY = [
  '## Decision brief (summary)',
  '',
  '### Where it came from',
  'You asked for this on 4 November.',
  '',
  '### Why it exists',
  'Replies could show up in the wrong order.',
  '',
  '### What will change',
  'Replies now always show in the order they were sent.',
  '',
  '### Key assumptions',
  'Two replies in the same second keep their arrival order.',
  '',
  '### Out of scope',
  'Editing replies.',
  '',
  "### What you're agreeing to",
  'Nothing reaches users until you merge.',
  '',
  '### Suggested next',
  '- Add search to Projects',
].join('\n')

const board = useBoard('35')

const doneMessages = async (taskId: string) =>
  (await readComments(board(), taskId)).filter((c) => c.kind === 'done')

describe('B7-35 finishing a task writes the Done message', () => {
  it('writes one Done message carrying the summary and marks the task unread', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null, unread: false })
    await board().updateTask({ task_id: task.id, status: 'done', summary: SUMMARY })
    const done = await doneMessages(task.id)
    expect(done).toHaveLength(1)
    expect(done[0]).toEqual(
      expect.objectContaining({ author: 'agent', kind: 'done', body: SUMMARY, taskId: task.id })
    )
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('done')
    expect(stored.unread).toBe(true)
    expect(stored.summary).toBe(SUMMARY)
  })

  it('says "Done." when the session gives no summary', async () => {
    const task = await taskAt(board(), 'chore', { stage: 'do', needs: null, unread: false })
    await board().updateTask({ task_id: task.id, status: 'done' })
    const done = await doneMessages(task.id)
    expect(done).toHaveLength(1)
    expect(done[0].body).toBe('Done.')
    expect((await readTask(board(), task.id)).unread).toBe(true)
  })

  it('writes no second Done message for a task that is already done', async () => {
    // Already done but still bound to this session (agentId kept), so the call reaches the
    // already-done guard instead of being refused as someone else's task.
    const task = await taskAt(board(), 'bugfix', {
      stage: 'done',
      doneAt: Date.now() - 60_000,
      needs: null,
      working: false,
      unread: false,
    })
    // The contract may let the call be refused; either way nothing may be written.
    await board()
      .updateTask({ task_id: task.id, status: 'done', summary: 'Fixed the export again.' })
      .catch((err: unknown) => err)
    expect(await doneMessages(task.id)).toEqual([])
    expect((await readTask(board(), task.id)).unread).toBe(false)
  })

  it('does not write a Done message for other updates', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'build', needs: null })
    await board().updateTask({ task_id: task.id, status: 'in_progress', summary: 'Halfway.' })
    await board().updateTask({ task_id: task.id, summary: 'Nearly there.' })
    expect(await doneMessages(task.id)).toEqual([])
    const done = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await board().updateTask({ task_id: done.id, status: 'done', summary: 'Shipped.' })
    expect((await doneMessages(done.id)).map((c) => c.body)).toEqual(['Shipped.'])
  })
})
```

### tests/board-briefs-b7-37.test.ts

```
// board-briefs B7, criterion 37: the instructions a new session receives when it connects (the
// MCP server's `instructions`, now SESSION_INSTRUCTIONS in packages/agent/src/instructions.ts and
// passed by index.ts) tell it how to post briefs: the spec brief as the note when it sets spec to
// awaiting_approval; fix, round and summary briefs as a kanban_ask question ending with the
// `Reply "<phrase>"` line; the pull request with pr_url once it is open; and to finish with status
// "done" and a summary that ends with `### Suggested next` (one per line) when it has follow-ups.
// Each rule is checked within one paragraph or numbered step, so the words belong together.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

// The paragraphs and numbered steps of the instructions.
const chunks = (text: string) =>
  text
    .split(/\n\s*\n|\n(?=\s*\d+\.\s)/)
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

// The paragraphs or steps that mention every one of `words` (strings or patterns).
const saying = (...words: (string | RegExp)[]) =>
  chunks(SESSION_INSTRUCTIONS).filter((c) =>
    words.every((w) => (typeof w === 'string' ? c.includes(w) : w.test(c)))
  )

// Starts the real agent over stdio, offline, the way packages/agent/test/protocol.ts does: no
// emulator, and KANBAN_SA pointed at this test file (it exists but is not a key), so the agent's
// Firestore init fails before it could reach any real key on this machine. Sends initialize and
// returns its result; closing stdin then shuts the agent down.
const ROOT = join(import.meta.dirname, '..')
async function initializeAgent(): Promise<{ instructions?: string }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_SA: fileURLToPath(import.meta.url),
    KANBAN_PROJECT_ID: 'demo-kanban',
  }
  delete env.FIRESTORE_EMULATOR_HOST
  delete env.KANBAN_TEST_LIVE
  const child = spawn(process.execPath, [join(ROOT, 'packages', 'agent', 'src', 'index.ts')], {
    env,
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stderr.resume()
  try {
    return await new Promise((resolve, reject) => {
      let buf = ''
      child.on('error', reject)
      child.on('exit', (code) => reject(new Error(`agent exited (${code}) before initialize`)))
      child.stdout.on('data', (d: Buffer) => {
        buf += d.toString()
        for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 1)
          if (!line) continue
          const msg = JSON.parse(line) as { id?: number; result?: { instructions?: string } }
          if (msg.id === 1) resolve(msg.result ?? {})
        }
      })
      const initialize = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'board-briefs-b7-37', version: '0' },
        },
      }
      child.stdin.write(`${JSON.stringify(initialize)}\n`)
    })
  } finally {
    child.stdin.end()
    child.kill()
  }
}

describe('B7-37 the session instructions', () => {
  it('is a non-empty text that still explains the channel', () => {
    expect(typeof SESSION_INSTRUCTIONS).toBe('string')
    expect(SESSION_INSTRUCTIONS).toContain('from="james"')
    expect(SESSION_INSTRUCTIONS).toContain('kanban_ask')
  })

  it('says to post the spec brief as the note when setting spec to awaiting_approval', () => {
    expect(
      saying('awaiting_approval', /\bnote\b/, /spec brief|decision brief \(spec\)/i)
    ).not.toEqual([])
  })

  it('says to post fix, round and summary briefs as a kanban_ask question ending with the Reply line', () => {
    expect(
      saying('kanban_ask', /\bfix\b/, /\bround\b/, /\bsummary\b/, /brief/i, 'Reply "')
    ).not.toEqual([])
  })

  it('says to report the pull request with pr_url once it is open', () => {
    expect(saying('pr_url', /\bPR\b|pull request/i)).not.toEqual([])
  })

  it('says to finish with status done and a summary ending with ### Suggested next', () => {
    expect(
      saying(
        /\bdone\b/,
        /\bsummary\b/,
        '### Suggested next',
        /one (suggestion )?per line/i,
        /follow-?ups?/i
      )
    ).not.toEqual([])
  })

  it('is what the MCP server sends: initialize returns SESSION_INSTRUCTIONS', async () => {
    expect((await initializeAgent()).instructions).toBe(SESSION_INSTRUCTIONS)
  }, 30_000)
})
```

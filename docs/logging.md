# Logging — kanban

Instantiates `_principles/observability.md` and `_principles/traceability.md` through the
`instrument` skill. Posture chosen at setup: **structured logs to stdout** (no webhook, no
warehouse pipeline yet).

## Where logs go

| Emitter                                 | Logger                                                                            | Destination                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Desktop agent (`packages/agent`), hooks | `log()` lines; failures also through `logFailure` (`src/app-log.ts`)              | stderr + `packages/agent/agent.log` (stdout is the MCP transport); failures also stored in `logs` (at most 20 per rolling minute) |
| Web app (`packages/web`)                | `logging/logger.browser.js`, `source: 'web_client'`, transport `lib/log-store.ts` | stored in `logs` while James is signed in; dropped while signed out                                                               |

Events live in the top-level Firestore collection `logs` for 30 days (TTL on `expireAt`;
ADR 0004). Browsers may only create events of the exact shape; nobody reads them from a
browser. **To read them, a kanban session calls `kanban_logs`**: no arguments gives the last
24 hours of warnings and worse; `request_id` gives one operation's whole trail across the
phone and the agents; `min_severity`, `since_minutes`, `source` and `limit` narrow it.

The standard route (ingestion endpoint → Cloud Logging → the client's BigQuery dataset) is
still unbuilt: the client's registry logging block is `TBD-jamesdavisonio-logging-project`,
`provisioned: false`. When it exists, set `log_endpoint` in `app.manifest.yaml` and drop the
transport.

## Identity

`app.manifest.yaml` carries `app_id: kanban`, `client_id: jamesdavisonio` and the pinned
versions of the vendored governed files in `logging/`. Feature code never hardcodes these. The web
bundle reads them through the Vite virtual module `virtual:app-manifest` (parsed from the YAML
at build time in `packages/web/vite.config.ts`), which adds `env` from the Vite mode: `prod`
for a production build, `dev` otherwise. `packages/web/src/lib/log.ts` is the only place the
browser logger is created.

## Event types

Only values from `logging/taxonomy.json` (rules R1–R3 in `instrument/SKILL.md`). The ones
this app expects to use: `session_start` / `session_end` (web), `user_action` (approve,
answer, reopen, merge-confirmed), `milestone_reached` (task stage changes), `api_call_failed`
(Firestore, `gh`), `feature_error`. Anything else is `unclassified` with
`context.proposed_type` and a note to James.

## Trace ids

One `request_id` per operation, with a source prefix: `web-<ulid>` for a user action in
the PWA, `agent-<ulid>` for a tool call or a delivery, `hook-<ulid>` for a Claude Code hook
run. A delivery keeps the id of the comment write that caused it in `context.parent_id`.

## Severity and alerting

INFO for business events, WARNING for degraded (stale agent, retrying), ERROR for a failed
tool call or write, CRITICAL for "a James message cannot reach a live session". No alerting
tiers are wired yet (`ops.alerting_tiers_enabled: []`); the signal James watches is the
task's own delivery ticks on the phone.

# Logging — kanban

Instantiates `_principles/observability.md` and `_principles/traceability.md` through the
`instrument` skill. Posture chosen at setup: **structured logs to stdout** (no webhook, no
warehouse pipeline yet).

## Where logs go

| Emitter                                 | Logger                                               | Destination today                                                 | Destination when provisioned                                                                             |
| --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Desktop agent (`packages/agent`), hooks | `logging/logger.server.js` — one JSON line per event | stderr + `packages/agent/agent.log` (stdout is the MCP transport) | Cloud Logging is not applicable (no GCP runtime); stays local, or forwarded by a later `instrument` step |
| Web app (`packages/web`)                | `logging/logger.browser.js`, `source: 'web_client'`  | buffered, dropped (no endpoint)                                   | `log_endpoint` in `app.manifest.yaml` once the `jamesdavisonio` client logging project exists            |

The client's logging block in the registry is still `TBD-jamesdavisonio-logging-project`,
`provisioned: false`. Until James provisions it (commands in the skills repo,
`instrument/references/destinations.md`), browser events are not stored anywhere.

## Identity

`app.manifest.yaml` carries `app_id: kanban`, `client_id: jamesdavisonio` and the pinned
versions of the vendored governed files in `logging/`. Feature code never hardcodes these.

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

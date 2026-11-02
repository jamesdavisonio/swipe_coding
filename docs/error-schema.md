# Error schema — kanban

Instantiated from the skill set's `_principles/error-schema.md`. Every error the agent or
the web app logs uses this shape so it can be queried next to every other app's errors.
`application_id` is always `kanban`.

| Field | Type | kanban value / rule |
|---|---|---|
| `timestamp` | ISO 8601 | when it happened |
| `application_id` | string | `kanban` |
| `environment` | `production` \| `development` | from `APP_ENV` (agent) or Vite mode (web) |
| `severity` | `critical` \| `warning` \| `info` | routes alerting; see `docs/logging.md` |
| `error_type` | string | category: `firestore_write_failed`, `channel_delivery_failed`, `gh_poll_failed`, `validation_failure`, … |
| `feature` | string | `agent.tools`, `agent.listener`, `agent.github`, `web.threads`, `web.sheet`, … |
| `source_file` | string | `packages/agent/src/board.ts:123` |
| `user_id` | string \| null | always `null` — single owner, never log the email |
| `request_id` | string | the operation's trace id: `agent-<ulid>`, `web-<ulid>`, `hook-<ulid>` |
| `message` | string | human-readable summary, no document bodies |
| `context` | object | flat, snake_case, primitives: `task_id`, `comment_id`, `agent_id`, `project_id`, `pr_number`, `status` |

## Rules for this repo

- Comment bodies, spec text and task titles never go into `message` or `context` — log ids.
- The agent logs through the shared server logger (`logging/logger.server.js`), never a bare
  `console.error(e)` in feature code; the existing `log()` helper wraps it.
- `severity: critical` is reserved for "James's message cannot reach a live session"
  (listener dead, Firestore unreachable while a task is bound).
- Errors shown to James in the UI are separate strings; the log `message` is for queries.

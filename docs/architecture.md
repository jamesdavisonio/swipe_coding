# Architecture — kanban

One page. The full design and its history live in [DESIGN.md](../DESIGN.md).

```
 phone / laptop browser                    Firebase (kanban-nullnoise)            desktop (per machine)
 ┌──────────────────┐   Firestore SDK   ┌──────────────────────┐   Admin SDK      ┌──────────────────────────┐
 │ PWA  packages/web│◄───onSnapshot────►│ Firestore (eur3)      │◄──onSnapshot───│ kanban agent             │
 │ React 19 · Vite  │                   │ Auth: Google, 1 owner │                 │ packages/agent (MCP      │
 │ Tailwind 4       │◄──FCM push────────│ Hosting · FCM         │◄──hooks────────│ channel + tools, Node 24)│
 └──────────────────┘                   └──────────────────────┘                 │   └─ claude session      │
                                                                                 │      cwd = project       │
                                                                                 └──────────────────────────┘
```

## Components

- **packages/web** — the phone-first PWA. Reads and writes Firestore directly with the
  owner's Google identity. Threads-first UI per `prototype/index.html`.
- **packages/agent** — one process per Claude Code session, spawned by Claude Code as an
  MCP server (`claude mcp add --scope user kanban`). Exposes `kanban_*` tools; declares
  the channel capability so James's comments arrive in the session as `<channel>` events.
  Uses the Admin SDK with a service-account key; heartbeats presence; announces queued
  tasks; marks delivery.
- **packages/shared** — types, stage templates, project-id derivation (plain TS).
- **Firestore** — top-level collections `projects`, `agents`, `tasks`, `comments`,
  `todos`; numeric ms timestamps; rules allow the owner only; agents bypass rules.
- **GitHub** — the agent polls `gh pr view` for mergeability and merge state, then the
  main-branch checks, to advance `pr → merged → main_ci → after_deploy | done`.

## Boundaries and trust

- The browser can only write `author: james` documents; agents only write as themselves.
- A `<channel from="james">` event is treated by sessions as typed by James; destructive
  actions still go through Claude Code's own permission prompt.
- The desktop connects outbound only; nothing is exposed on the home network.
- The service-account key lives outside the repo and outside `%APPDATA%` (the MSIX-packaged
  desktop app virtualises AppData for its child processes).

## Data flow for one task

1. James queues a task (PWA) → `tasks` doc `queued`.
2. The agent in that folder announces it; the session binds it (`kanban_start_task`).
3. Session submits a spec → task `waiting_on_james`; James approves from the sheet.
4. Session builds, opens a PR; when `gh` says mergeable + checks green → `pr` + ping.
5. James merges in GitHub; the agent sees the merge, watches main CI, then either
   `after_deploy` (pings James with his manual steps) or `done`.
6. Every decision is appended to the task's log; done tasks leave lists after 7 days.

## Logging

Agent: structured JSON lines (shared server logger) to stdout and `agent.log`. Browser:
shared browser logger, buffered, to the client log endpoint once provisioned. Event
types come from the vendored taxonomy; see `docs/logging.md`.

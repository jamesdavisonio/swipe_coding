# AGENTS.md

Phone-first board where James follows and steers his local Claude Code sessions. Each
project folder is a project; each piece of work is a task with a fixed stage chain; sessions
report in through an MCP server and receive James's replies through a background watcher
(`packages/agent/src/wait.ts`, ADR 0005).

## Stack

- **Runtime:** TypeScript on Node 24 (type stripping: `.ts` imports keep the extension, no enums)
- **Frontend:** React 19, Vite 7, Tailwind 4 — `packages/web` (PWA)
- **Backend:** Firestore via firebase-admin from the desktop agent — `packages/agent` (MCP server + Claude Code channel). No Cloud Functions.
- **Data:** Firestore `eur3`, project `kanban-nullnoise`; collections `projects`, `agents`, `tasks`, `comments`, `todos`, `logs`, `devices`
- **Push:** decision cards notify the phone via Firebase Cloud Messaging, sent by the notifier process (ADR 0006, `docs/features/notifier.md`); `VITE_FIREBASE_VAPID_KEY` in `packages/web/.env`
- **AI:** none in the app
- **Deploy:** Firebase Hosting + Firestore rules; `npm run deploy`

## How to run locally

```
npm install
npm run web                # Vite dev server; packages/web/.env holds the Firebase web config
npm run notifier           # the decision notifier (node --watch); or `npm run notifier:install` once for a logon task
```

## How to run tests

```
npm test                   # vitest: unit + web component tests (tests/*.test.tsx, jsdom), not tests/rules
npm run test:rules         # emulator: Firestore rules + the web data layer (needs Java 21 on PATH)
npm run test:agent         # agent stdio protocol test; offline by default. Board path:
                           #   firebase emulators:exec --only firestore --project demo-kanban "npm run test:agent"
npm run typecheck          # agent, web and the root tsconfig (tests/, packages/shared)
```

## Conventions

- Shared types and stage templates live in `packages/shared`; both packages import `@kanban/shared`.
- UI: tokens in `packages/web/src/styles/tokens.css` (never hardcode colours/sizes), primitives in `src/components/ui/`, icons only via `src/lib/icons.ts`, dark mode = `.dark` class. WCAG AA: focus ring, name, keyboard path, 44px targets; `docs/design-system.md`.
- The agent never writes to stdout except MCP; log with `log()` (stderr + `agent.log`).
- All Firestore timestamps are numeric ms (except `logs.expireAt`, a TTL Timestamp); all collections are top-level.
- App errors from the phone and the agents: read them with the `kanban_logs` tool (`docs/logging.md`) before reproducing in the emulator.
- Logging goes through `logging/logger.*.js`; event types only from `logging/taxonomy.json`.
- Errors follow `docs/error-schema.md`; one `request_id` per operation (`docs/logging.md`).

## Not used in this project

- **No Cloud Functions** — the desktop agent is the only server-side code.
- **No Redux/Zustand** — Firestore `onSnapshot` hooks in `packages/web/src/data.ts`.
- **No i18n library** — single owner, English only.

## Gotchas

- The desktop app is an MSIX package: its child processes see a virtualised `%APPDATA%`. The service-account key lives at `..\kanban-secrets\sa.json`, never in AppData.
- James's replies reach a session only while it runs the watcher command from `kanban_create_task` / `kanban_start_task` as a background command; channel events (now only queued-task announcements) need `--dangerously-load-development-channels server:kanban` and never reach desktop-app or orchestrator-started sessions.
- Claude Code currently spawns the agent twice per session (open issue, DESIGN.md Phase 1).
- The Firestore emulator needs Java 21: on James's PC it is a zip install at `Documents\tools\jdk-21` (on the user PATH; older shells need it prefixed). Never run `KANBAN_TEST_LIVE=1` from an agent; use the emulator form above.

## Documentation

- Vision & brief: `docs/brief.md` · Architecture: `docs/architecture.md` · Full design: `DESIGN.md`
- Error schema: `docs/error-schema.md` · Logging: `docs/logging.md` · Decisions: `docs/decisions/`

## Skills used in this repo

- Setup chain done: `setup-project` · `setup-tooling` · `setup-security` · `bootstrap-design-system` (`gate_stage: ui-ready`)
- `ship` / `implement-feature` for behaviour · `change-ui` for UI · `check` before every commit · `pre-deploy-check` before deploy

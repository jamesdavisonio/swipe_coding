# kanban

A phone-first board where local Claude Code sessions report into tasks and receive
James's comments as channel events. Design: [DESIGN.md](DESIGN.md).

```
packages/shared   types, task templates, project-id derivation (plain TS, no build)
packages/agent    the Claude Code channel MCP server + hooks (Node 24, Admin SDK)
packages/web      the PWA (React 19, Vite, Tailwind 4, Firebase JS SDK)
firebase.json / firestore.rules / firestore.indexes.json
```

## One-time setup

### Firebase project
1. Create a project, enable **Firestore** (native mode) and **Authentication → Google**.
2. Add a **Web app**; copy its config into `packages/web/.env` (see `.env.example`).
3. A service-account key (IAM → Service Accounts → `kanban-agent`, role *Cloud Datastore
   User* → Keys → JSON). Save it as **`C:\Users\Intel\Documents\code\kanban-secrets\sa.json`**
   — a sibling folder of this repo, never inside it. Do **not** use `%APPDATA%`: the Claude
   desktop app is an MSIX package, and processes it starts (terminal panel, sessions, MCP
   servers) see a virtualised `AppData\Roaming`, so a file there is invisible to them.
   `KANBAN_SA=<path>` overrides the location if you must.
4. Put the project id in `.firebaserc`, then `npx firebase login` and
   `npx firebase deploy --only firestore` to push rules and indexes.
5. Hosting → add custom domain `kanban.nullnoise.ai` and create the DNS record it asks for.

### Desktop (per machine)
Register the agent once, user-wide, so every project folder has it:

```bash
claude mcp add --scope user kanban -- node C:/Users/Intel/Documents/code/kanban/packages/agent/src/index.ts
```

Start sessions that should be on the board with:

```bash
claude --dangerously-load-development-channels server:kanban
```

Hooks (optional but recommended): see `packages/agent/hooks/README.md`.

## Development

Local emulators need Java 11+ (`winget install Microsoft.OpenJDK.21`).

```bash
npm install
npm run emulators          # Firestore :8080, Auth :9099, UI :4000, project demo-kanban
npm run web                # Vite dev server; set VITE_USE_EMULATOR=true in packages/web/.env
```

Run an agent against the emulator from any folder:

```bash
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 && claude --dangerously-load-development-channels server:kanban
```

Checks: `npm test` (vitest, `tests/`), `npm run typecheck`, `npm run test:agent`
(`KANBAN_TEST_LIVE=1` runs the full flow against the real project).

Project conventions for agents and humans: [AGENTS.md](AGENTS.md); profile the skills read:
`.project-profile.yaml`; brief, architecture, error schema, logging and ADRs under `docs/`.

## Deploy

```bash
npm run deploy             # builds the web app and deploys hosting + rules + indexes
```

## License

MIT — see [LICENSE](LICENSE).

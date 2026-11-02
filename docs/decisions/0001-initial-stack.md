# ADR 0001: Firebase backend with a desktop MCP channel agent

**Status:** Accepted
**Date:** 2026-11-02

## Context

James needs to steer Claude Code sessions running on his desktop from his phone without
Remote Control. The hard requirements are: a message from the phone reaches a specific
running session within a minute; sessions can write into tasks; nothing is exposed on the
home network; a single owner. Claude Code offers channels (an MCP server can push events
into a running session), which solves the inbound direction without any server of our own.
James already uses Firebase on his other projects.

## Decision

- **Inbound and outbound both go through one MCP server per session** (`packages/agent`),
  registered user-wide, started with the dev-channel flag. It exposes `kanban_*` tools and
  pushes James's comments as `<channel>` events.
- **Firebase is the whole backend**: Firestore is both the data store and the realtime
  bus (`onSnapshot` on the phone and in the agent); Auth with Google sign-in restricted to
  the owner's emails; Hosting for the PWA; FCM for push. No Cloud Functions in Phase 1.
- **The web app is React 19 + Vite + Tailwind 4**, TypeScript throughout, Node 24 with
  native type stripping so `packages/shared` and the agent run without a build step.
- Desktop agents authenticate with a service-account key (Cloud Datastore User) kept
  outside the repo and outside `%APPDATA%`.

## Consequences

- Positive: no server to host or secure; realtime for free; latency measured at ~250 ms
  from Firestore write to channel event; the owner-only rules are one line.
- Negative: custom channels are a research preview and need an interactive session plus
  a confirmation dialog per start; headless/SDK sessions cannot use them (Phase 3 needs
  another path). Firestore's document model shapes the data (top-level collections,
  denormalised `agentId` on comments). The org policy on service-account keys had to be
  overridden for this project.
- Neutral: the agent polls GitHub via `gh` for PR/CI state rather than receiving
  webhooks, since there is no public endpoint.

## Alternatives considered

- **Fly.io + SQLite + WebSockets (own backend).** More code (hub, auth, replay), one more
  thing to host; rejected once Firestore's `onSnapshot` covered the realtime need.
- **Agent SDK headless runner instead of channels.** Full control of the task state
  machine, but the dev-channel flag is ignored there, and James wanted his existing
  desktop-app sessions on the board. Kept for Phase 3.
- **Existing tools (CodeAgentSwarm, Vibe Kanban, Omnara, Happy).** None are phone-first
  with projects, typed stages and a "for James" list; Vibe Kanban's company shut down.

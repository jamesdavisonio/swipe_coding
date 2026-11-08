# 6. Decision cards reach the phone as Firebase Cloud Messaging web pushes from the agent

Date: 2026-11-08

## Status

Accepted.

## Context

A decision (a spec, a failed CI, a fix, another round, ship it, a question) waited on the board
until James happened to open it, and the session asking for it sat idle. The board is a PWA on
James's Android phone; there are no Cloud Functions (ADR 0001), so whatever sends a notification
has to be the desktop agent or the browser itself
(`docs/features/decision-notifications.md`).

## Decision

- The **desktop agent sends**, right after it writes the decision (`Board.setSubtask` spec →
  `awaiting_approval`, `Board.ask`), through a small push port (`packages/agent/src/push.ts`)
  backed by firebase-admin Cloud Messaging. Only decision cards notify; merges, after-deploy
  steps, to-dos and finished work stay silent.
- **Browsers register** in a new top-level `devices` collection, one record per browser under a
  random id kept in localStorage (`{ token, createdAt, updatedAt }`), written by the owner from
  the overview's "Notify me of decisions" switch and validated by the rules.
- Messages are **data-only**; a plain service worker (`packages/web/public/sw.js`, no Firebase
  SDK inside) shows them and opens or focuses the board on that card. The content security
  policy only adds the two FCM registration hosts to `connect-src`; no outside script is loaded.
- The notice's kind and text come from **one shared derivation** in `@kanban/shared` that the deck
  also uses, so a notification always reads like its card. Each task has one notification tag,
  so a revised card replaces the previous one.
- A push failure never fails the session's tool call: it stores an `api_call_failed` warning
  readable with `kanban_logs`. Tokens FCM reports as unregistered are deleted. Against the
  Firestore emulator nothing is sent.

## Consequences

- One manual step per project: a Web Push certificate (VAPID key) from the Firebase console in
  `packages/web/.env` as `VITE_FIREBASE_VAPID_KEY`. The web messaging sender id is derived from
  the app id, so no second key is needed.
- The agent's service account needs permission to send through Cloud Messaging.
- Only sessions that load the new agent send; older sessions stay silent until restarted.
- Clearing a notification answered elsewhere, quiet hours and actions on the notification itself
  are not covered.

# Feature: Phone notifications for decision cards

**Status:** Drafting
**Date:** 2026-11-08
**Task class:** Large (four behaviours, N1–N4, across web, agent, shared and hosting; numbering
continues from `swipe-deck.md`, 42–70)

## Decision brief (spec)

Yes: Start building notifications for decision cards

### Where it came from

You asked on 8 November to look into notifications for decision cards only, and agreed to the defaults I proposed.

### Why it exists

A decision waits until you happen to open the board, so the session asking for it sits idle.

### What will change

Your phone notifies you when a session needs a decision: a spec, a failed CI, a fix, another round, ship it or a question. For example, "Spec · kanban" with "Start building notifications for decision cards", and tapping it opens the deck on that card.

### Key assumptions

You turn it on once with the bell in the overview. Only sessions started after the merge send notifications.

### Out of scope

Merge cards, quiet hours, and clearing a notification you answered somewhere else.

### What you're agreeing to

One key to create in the Firebase console, which I will walk you through, and one build to a pull request.

## What the user sees

In the deck's overview (swipe down) there is a bell. Tapping it once asks Chrome for permission
to notify; after that, whenever a session puts a decision on the board, the phone shows a
notification even when the board is closed. Only decision cards notify: spec, CI failed, fix,
another round, ship it and question. Merge, after-deploy steps, to-dos, finished work and
suggestions stay silent. The notification shows the card's kind and project as its title and the
card's headline (what yes does) as its text, so it reads like the card itself. A revised card
replaces its earlier notification instead of adding a second one. Tapping the notification opens
the board, or brings an open board to the front, on the deck with that card first. Tapping the
bell again turns notifications off for that browser.

Example, on James's Android lock screen at 14:32:

> **Spec · kanban**
> Start building notifications for decision cards

and later, from another project:

> **CI failed · data-trackers**
> Fix the lint error that failed CI on PR 531

## Acceptance criteria

### N1 — Turning it on and off (web, the overview's bell)

71. Given notifications are off on this browser and it can receive push, when James opens the
    overview, he sees a control named "Notify me of decisions" in its off state.
72. Given that control is off, when James taps it and grants permission, this browser is
    registered (one device record holding its push token appears) and the control shows on.
73. Given James denies permission, or Chrome already blocks notifications for the board, when he
    taps the control, nothing is registered and the overview says notifications are blocked in
    Chrome's site settings.
74. Given the browser cannot receive push (no notifications, service worker or push support), the
    overview shows the control disabled with the text "Not available in this browser".
75. Given the control is on, when James taps it, this browser's device record is removed, its push
    token is deleted, and the control shows off.
76. Given the control is on and the board loads again, the browser keeps exactly one device
    record: a changed push token replaces the stored one instead of adding a second record.

### N2 — Sending (the desktop agent)

77. Given one or more registered devices, when a session posts a spec for approval
    (`kanban_subtask` spec → `awaiting_approval`), each device receives one notification whose
    title is "Spec · <project name>" and whose text is the headline the deck shows for that spec
    card (the brief's `Yes:` line, else "Start building: <task title>"), cut to 60 characters the
    same way the card cuts it.
78. Given one or more registered devices, when a session asks a question (`kanban_ask`, with or
    without options), each device receives one notification titled "<kind label> · <project
    name>" with the deck's headline for that card, where the kind is the one the deck gives that
    question: CI failed, Fix, Another round, Ship it or Question.
79. Given a session reports a pull request ready to merge, after-deploy steps, a to-do, a comment
    or a finished task, no notification is sent.
80. Given a task already has a notification, when the session posts a revised spec or a new
    question on the same task, the new notification replaces the old one on the phone (one per
    task, never stacked).
81. Given no registered devices, the session's tool call behaves exactly as before and nothing is
    sent.
82. Given sending fails (network, push service error), the session's tool call still succeeds with
    its usual reply, and a warning naming the task and the failure is readable through
    `kanban_logs`.
83. Given the push service reports a device's token is no longer registered, that device record is
    removed, so later decisions are not sent to it again.

### N3 — Tapping a notification (web, service worker and deck)

84. Given a decision notification, when James taps it and no board tab is open, the board opens on
    the deck with that task's card first, then the rest in their usual order.
85. Given a board tab is already open, when James taps the notification, that tab comes to the
    front and the deck shows that task's card first.
86. Given the task no longer waits on a decision when James taps, the deck opens in its usual order
    with no error.

### N4 — Hosting and rules

87. Given a signed-in owner, the browser can create, read, update and delete device records; a
    record may hold only its token and its created and updated times, and any other field, a
    non-string token or a token over 4096 characters is rejected. Anyone else is refused.
88. Given the deployed board, the browser may reach the push registration services (the content
    security policy allows them), and the service worker file is served uncached like the page.

## Out of scope

- Merge, after-deploy, to-do, finished-work and suggested-next notifications.
- Quiet hours or per-project muting (Android's Do Not Disturb and Chrome's own per-site settings
  cover this).
- Clearing a notification when the decision is answered elsewhere (session chat, another device).
- Acting on a card from the notification itself (yes/later buttons on the notification).
- Offline use or caching by the service worker; it only receives and opens notifications.
- iPhone support (works only for an installed web app there; James uses Android).
- Notifications from sessions still running the old agent (they need a restart).

## Public contract and existing boundaries

**Observed baseline** (main at `5894c84`):

- Decisions are written in two places in `packages/agent/src/board.ts`: `Board.ask` writes
  `needs: { kind: 'question', question, options? }` with an agent comment of kind `question`, and
  `subtaskPatch` returns `needs: { kind: 'spec' }` for spec → `awaiting_approval`, with the spec
  brief as the step's note. `Board` is constructed as `new Board(cwd = process.cwd())`.
- The deck derives card kind and headline in `packages/web/src/lib/deck.ts`: `questionKind`
  (gate `fix` → `ci_failed` when the stage is `pr`, `merged` or `main_ci`, else `fix`; `round` →
  `round`; `summary` → `summary_gate`; else `question`), `FALLBACK_PREFIX`, `questionTitle`,
  `specCard` (`brief?.yes ?? 'Start building: <title>'`), `fitHeadline` with `HEADLINE_MAX = 60`,
  and `KIND_LABEL`. Briefs are parsed by `parseBrief` in `packages/web/src/lib/brief.ts`.
- Card ids are `<kind>:<taskId>`; the overview's project tap puts a project's cards first.
- Collections are listed in `COLLECTIONS` in `packages/shared/src/index.ts`; rules in
  `firestore.rules` (`isOwner()`); hosting headers and CSP in `firebase.json`, with `no-cache` on
  `**` and long caching on `/assets/**`. There is no service worker today.
- Web uses `firebase` 12.x, the agent `firebase-admin` 13.x, which includes Cloud Messaging.

**Selected new contract** (planner decisions within the confirmed scope):

- `COLLECTIONS.devices = 'devices'`; `Device = { token: string; createdAt: number; updatedAt: number }`,
  document id a random per-browser id kept in localStorage.
- The card-kind and headline derivation for decision cards moves to `packages/shared` (with
  `parseBrief`), and both the deck and the agent use it; `packages/web/src/lib/brief.ts` and
  `deck.ts` keep their exports (re-exports), so web imports are unchanged.
- A pure `decisionNotice(task, projectName, briefText?)` in shared returns
  `{ title, body, tag: 'decision:<taskId>', url: '/?task=<taskId>' }` for a spec or question need,
  and `null` for any other need.
- The agent sends through a small push port (`sendDecision(notice, tokens)` returning per-token
  outcomes), backed by firebase-admin Cloud Messaging as data-only web push; `Board` accepts it as
  an optional second constructor argument so tests can capture what would be sent.
- `packages/web/public/sw.js` handles `push` (shows the notice with its tag) and
  `notificationclick` (focus or open `url`); no Firebase SDK inside the worker.
- The deck reads `?task=<taskId>` and puts that task's card first.
- The VAPID public key comes from `VITE_FIREBASE_VAPID_KEY` in `packages/web/.env`.

**Unresolved:** none.

## Files & modules affected

- `packages/shared/src/index.ts`, new `packages/shared/src/brief.ts` and `decision.ts` — `Device`,
  `COLLECTIONS.devices`, shared brief parsing, decision kind/headline, `decisionNotice`
- `packages/web/src/lib/brief.ts`, `packages/web/src/lib/deck.ts` — use the shared derivation;
  re-exports
- `packages/web/public/sw.js` (new) — push and click handling
- `packages/web/src/lib/push.ts` (new) — support check, permission, token, enable/disable
- `packages/web/src/data.ts` — device record writes
- `packages/web/src/components/deck/OverviewSheet.tsx`, `packages/web/src/pages/Deck.tsx` — bell
  control; `?task=` puts that card first
- `packages/web/src/lib/icons.ts` — bell icons
- `packages/agent/src/push.ts` (new), `packages/agent/src/board.ts` — send after a decision is
  written; remove dead tokens
- `firestore.rules`, `firebase.json` — `devices` rules; CSP `connect-src` for
  `fcmregistrations.googleapis.com` and `firebaseinstallations.googleapis.com`
- `packages/web/.env.example` — `VITE_FIREBASE_VAPID_KEY`
- Tests under `tests/` and `tests/emulator/`

## Principles that apply

- `io-validation` — the device record is validated by the rules (keys, types, size); the agent
  parses device documents with zod before using a token; the service worker treats the push
  payload as untrusted (strings only, `url` must be same-origin).
- `idempotency` — one record per browser (fixed document id), and one notification per task (the
  `decision:<taskId>` tag), so retries and revisions replace instead of duplicating.
- `graceful-degradation` — a push failure never fails the session's tool call; unsupported or
  blocked browsers get a clear disabled state.
- `observability` — failures are logged through the existing loggers and readable with
  `kanban_logs`.
- `error-schema` — agent warnings use the existing log schema and `request_id`.

## Instrumentation

| event_type        | severity | context keys                                                                | audience |
| ----------------- | -------- | --------------------------------------------------------------------------- | -------- |
| `user_action`     | INFO     | `action` (`notifications_on`, `notifications_off`, `notifications_blocked`) | internal |
| `feature_error`   | WARNING  | `feature: notifications`, `reason` (token or registration failure)          | internal |
| `api_call_failed` | WARNING  | `service: fcm`, `task_id`, `error_code`, `device_count`, `removed`          | internal |

All three types exist in `logging/taxonomy.json`.

## Task class reasoning

Large: it spans web, agent, shared and hosting, adds a new collection with browser writes (a new
write path and input boundary), a new external service call from the agent, and changes the CSP
and rules (shared contract). Never-downshift triggers present: new input boundary, new write
path, shared contract. Full ceremony.

## Hand-over for James (before the build is tried)

- Firebase console → Project settings → Cloud Messaging → Web Push certificates → Generate key
  pair; paste the public key into `packages/web/.env` as `VITE_FIREBASE_VAPID_KEY`.
- If the agent's first send reports a permission error, the service account needs the Firebase
  Cloud Messaging send permission; the build will say exactly which role.

## Open questions

- None.

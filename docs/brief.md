# Brief — kanban

_Draft from the setup-project retrofit, 2026-11-02. Answers taken from James's own
description of the project; confirm or correct before Phase 5 writes the skeleton._

## Vision

**What and for whom.** A phone-first board where James follows and steers the Claude
Code sessions running on his desktop. Each project folder is a project; each piece of
work is a task with a fixed stage chain (spec → approved → build → PR → merged → main
CI → after-deploy → done). Sessions report into tasks through an MCP channel server and
receive James's replies within seconds. It replaces Remote Control for day-to-day
steering and gives him one place to see what needs him, what is happening, and what
finished. Users: James only. Clients: the Claude Code sessions on his machines.

**Who decides it is worth doing.** James, as the only user. No client, no budget owner.

**"It works" in one sentence.** A question a session asks reaches James's phone, his
answer reaches the session, and the task shows the right stage — all within a minute,
with sessions speaking only at the four moments that need him (spec ready, question,
PR ready, after-deploy ready).

**Out of scope for the first version.** Multi-user or sharing; launching sessions from
the phone (Phase 3, Agent SDK); approving Claude Code permission prompts from the phone
(permission relay, later); any AI calls made by the board itself; desktop-app chat
sessions that cannot carry the dev-channel flag.

## Architecture interview (12 areas)

1. **Users & access.** One user, Google sign-in restricted to `j@` / `james@nullnoise.ai`
   (verified). Sessions act through a service account with the Admin SDK and bypass
   rules; the UI can never write as an agent. No roles. Session expiry mid-write: the
   Firestore SDK retries on re-auth; nothing is lost because writes are small documents.
2. **Data.** Projects, agents, tasks, comments, todos, decision log entries in Firestore
   (`eur3`). PII: James's email in Auth only; task text may name repositories and
   branches, never other people's personal data. Retention: tasks and their history are
   kept indefinitely (lists hide them 7 days after done); agent presence docs are
   disposable. Data enters from the PWA and the desktop agent; it leaves only as push
   notifications and links to GitHub.
3. **AI use.** None in the application. Claude Code sessions are clients of the board,
   not called by it. `ai.enabled: false`.
4. **Success criteria.** Working: comment-to-session delivery under 10 s, round trip
   under 60 s including James; zero session chatter outside the four moments. Broken: a
   James comment undelivered for 5 minutes while its task shows a live agent, or a task
   in progress with no agent heartbeat. Baseline today: Phase 1 live test, 33 s round
   trip. James watches it.
5. **Compliance.** Internal, single owner, no customer data. UK GDPR formally applies to
   James's own account data only; no special category, no minors, no SCORM, no regulated
   industry. `data_sensitivity: minimal`.
6. **Integrations.** Firebase (Firestore, Auth, Hosting, FCM); Claude Code channels on
   the desktop; GitHub via `gh` for PR and CI state. Secrets: service-account key in
   `..\kanban-secrets\sa.json` (outside the repo, outside AppData because the desktop
   app virtualises it); the web config is public by design.
7. **Non-functional.** One concurrent user, a handful of agents; latency budget 10 s for
   delivery; availability best-effort (Firebase's).
8. **Delivery.** Solo, no deadline, built in Claude Code sessions with this skill set.
9. **Environments.** `production` only, plus the local emulator for tests (needs Java,
   not installed yet). Deploy: `npm run deploy` by hand today; a GitHub Actions deploy on
   merge to `main` is wanted (setup-security).
10. **Observability.** Structured logs to stdout from the desktop agent (`agent.log`),
    browser logger buffered to the shared log endpoint once provisioned; errors are
    visible in the agent log and Firebase console. Posture: `stdout`.
11. **Tracker.** None — this app is the tracker. GitHub PRs carry code review.
12. **Team.** Solo. Handover: this repo's docs and DESIGN.md.

Score: 12/12 answered; all five Critical areas covered.

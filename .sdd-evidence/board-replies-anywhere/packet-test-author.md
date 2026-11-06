# Test-author packet — board-replies-anywhere R1 (replies through a watcher)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot: commit
2ebcff5 on branch feat/board-replies-anywhere (clean tree). Spec file:
`docs/features/board-replies-anywhere.md` (quoted below in full; its "R1 contract details fixed
at test time" are the exact names you may assert).

## Rules (verbatim)

# Test-author rules

Given verbatim to the test author in its packet (step 2a of `implement-feature`). The test author receives these rules, the confirmed spec and assigned criteria, the grounded public contract and baseline facts, executable test-harness conventions, and `instrument/taxonomy.json` — nothing else, and never `SKILL.md`.

- Behavioural: assert on what the user or caller observes, not on internal structure.
- Minimal mocks. Prefer real integration where cheap; mock only external I/O.
- Cover assigned acceptance criteria one-for-one, their named edge cases, and applicable shared requirements. For split drafts, write only the assigned output; the combined gate checks full-spec coverage.
- Error paths assert observable logging with the spec's taxonomy `event_type`, severity and required context; use the existing isolated capture harness. Do not require `log.error` for WARNING events or mock away the logger under test.
- No `.only`, no `.skip`, no `xfail`. No sleep-and-retry.
- Test file names match the spec slug so review can diff them together.
- Reuse the existing harness. Name it in the packet (for this repo: the shared D1 helper the gate-1 suites use). Writing a new `tests/helpers/*-harness.mjs` or re-implementing `prepare/bind/first/all/run` is forbidden; extend the shared helper in one place if something is missing.
- The packet must name a helper observed in the target repository and cite its source path. The parenthetical above is an audit-supplied example, not evidence that the helper exists in another repository.
- One test file per acceptance ID (subtests inside), named `<slug>-<id>.test.mjs`. No splitting one ID across `-api`, `-api-validation`, `-api-tasks`, `-api-access-logging` files.
- Assert user-observable outcomes only (response bodies, rendered output, stored rows the user can read back). Do not assert internal counters, activity-table row shapes, or private helper return values.
- Target ratio: new test lines ≤ new application lines. Exceeding 1.5:1 requires a one-line justification in the evidence.

Repository notes on those rules: this repo is TypeScript; there is no D1 helper and no
`tests/helpers/`. The observed harnesses, quoted below:

- Emulator tests (`npm run test:rules`, `vitest.rules.config.ts`; `firebase emulators:exec` sets
  `FIRESTORE_EMULATOR_HOST`, project `demo-kanban`): `tests/emulator/*.test.ts`.
  - The desktop agent's real `Board` directly against the emulator:
    `tests/fixtures/board-briefs-b7-emulator.ts` (`useBoard`, `taskAt`, `readTask`,
    `readComments`), used by `tests/emulator/fix-stale-stage-need.test.ts`.
  - The real agent spawned over stdio against the emulator: `startAgent` / `useAgent` in
    `tests/fixtures/app-logs-emulator.ts` (used by `tests/emulator/app-logs-10.test.ts`). Its
    stdout reader drops JSON-RPC messages without an `id` (notifications), so a test that must
    observe channel notifications needs its own reader; put that in the new fixture below, do
    not edit the existing one.
- Unit tests (`npm test`, `vitest.config.ts`, no emulator): `tests/*.test.ts`.
- The watcher is a separate process: spawn it with `process.execPath` and the absolute path of
  `packages/agent/src/wait.ts`, with the emulator env as `startAgent` builds it
  (`KANBAN_PROJECT_ID=demo-kanban`, `FIRESTORE_EMULATOR_HOST` inherited, `KANBAN_SA` pointing at
  a non-key file, `KANBAN_TEST_LIVE` deleted). Never point anything at a real key or project.
- Waiting for an outcome: await the watcher's exit (with a timeout that fails the test) or a
  Firestore `onSnapshot` condition; no sleep-and-retry loops. To show that something does NOT
  happen (no reply printed, no notification), bound it by an event you do await (for example a
  later watcher's exit, or a tool call that returns after the write), not by sleeping.
  New shared setup goes in one new module `tests/fixtures/board-replies-anywhere-emulator.ts`.
  Name test files `tests/emulator/board-replies-anywhere-r1-<n>.test.ts` (one file per
  criterion n, 1–10) and, for checks that need no emulator, `tests/board-replies-anywhere-r1-<n>.test.ts`.
  Do not edit any existing test or fixture file. The implementation does not exist yet: `wait.ts`,
  `WATCHER_SETTLE_MS`, the `watcher` result field and `kanban_answered_in_session` are all missing,
  so every test must fail now for that reason (not an import crash that would hide which
  criterion is missing: import new symbols in a way that fails per test, or accept a whole-file
  failure only where the file covers one criterion).

## Spec (verbatim)

# Feature: Board replies reach every session

**Status:** Spec confirmed (2026-11-06, James: "spec confirmed")
**Date:** 2026-11-06
**Task class:** Medium (one behaviour, R1; it changes how James's replies are delivered and
marked received, a shared contract with every session, so full ceremony)

## Decision brief (spec)

### Where it came from

You asked on 6 November, after two board replies never reached a data-trackers session.

### Why it exists

Board replies only reach terminal sessions started with a special option. Sessions an orchestrator or the desktop app opens never hear them, yet the board shows them received.

### What will change

A session waiting on you runs a small background watcher. Your reply wakes it within seconds, in any session, at no cost while waiting. Answer in the session instead and the question leaves the board.

### Key assumptions

Background tasks can wait for hours and wake an idle session. The watcher uses the agent's existing key.

### Out of scope

Queued-task announcements and the board holding one question at a time.

### What you're agreeing to

A new watcher command, a new session tool, changed session instructions, and the "received" tick meaning picked up.

## What the user sees

On the phone, nothing looks different, but replies work in every session. James taps "fix
confirmed" or types a comment on a task; within a few seconds the session working on it wakes up
and carries on, whether it was started from a terminal, the desktop app, or by another session.
The "received" tick on his reply appears only once the session has actually picked it up, so a
reply that is still waiting shows as sent, not received. If he answers a question in the
session's own chat instead, the question stops asking for him on the board and the thread shows
that he answered in the session, with his answer.

In the session: after it takes a task, the session starts a watcher as a background task. The
watcher costs nothing while it waits. When James replies, it prints his reply and ends, and
Claude Code wakes the session with it; the session acts on the reply and starts the watcher
again.

## Acceptance criteria

### R1 — Replies through a watcher, and answers given in the session

1. Given a session has taken or created a task, when it calls `kanban_start_task` or
   `kanban_create_task`, then the result includes the exact command that starts this session's
   watcher, runnable from any working directory.
2. Given a watcher is running for a session and James posts a comment or an answer on a task
   bound to that session, then within a few seconds the watcher prints the reply (its task id,
   kind, comment id and full text, verbatim) and exits successfully.
3. Given replies for the session were already waiting when the watcher started, or several
   arrive close together, then the watcher prints all of them, oldest first, each exactly once,
   and exits.
4. Given a reply has been printed by a watcher, then it is marked received (the phone shows the
   received tick) and, when it answers the task's open question, the question no longer asks
   for James, exactly as an answer clears it today. A reply that no watcher has printed is not
   marked received.
5. Given no watcher is running when James replies, then the reply waits, unmarked, and the next
   watcher the session starts prints it.
6. Given two watchers run for the same session at once, then each reply is printed by only one
   of them.
7. Given the board is offline, the session is unknown, or the session's agent has shut down,
   when a watcher starts or while it waits, then it prints one line saying why and exits with a
   failure code; it never waits silently on something that cannot deliver.
8. Given the agent itself, then it no longer pushes James's comments and answers into the
   session as channel events, and it never marks a reply received on its own; a session started
   with the channel option gets its replies through the watcher like every other session.
9. Given James answered a question in the session's own chat, when the session records that
   with the new tool (task id and his answer), then the task stops asking for him, the thread
   shows a message from the session saying he answered in the session with his answer, and any
   later watcher does not print an answer for that question.
10. Given the session instructions, then they tell every session to start the watcher in the
    background after taking a task, to act on what it prints as James's own words, to start it
    again after handling each reply, and to record an answer given in chat with the new tool.

## Out of scope

- Queued-task announcements (James queues a task from his phone): they stay on the channel and
  still reach only sessions started with the channel option.
- The board holding one open question per task: a second `kanban_ask` still replaces the first.
  (Seen on 6 November with a fix brief and a spec brief asked together.)
- Keeping a watcher alive across a session restart; a resumed session starts a new one.
- Any change to the phone app beyond what the received tick already reads.
- Removing the stopgap in James's user-wide `CLAUDE.md` (done by hand once this ships).
- The phone's own tap logging gap (a gate tap at 04:09 on 6 November left no `gate_reply`
  event).

## Public contract and existing boundaries

Observed today (`packages/agent/src`):

- A comment is a top-level `comments/{id}` document with `taskId`, `agentId`, `author`
  (`james` | session), `kind` (`comment` | `answer`), `body`, `createdAt`, `deliveredAt`
  (numeric ms or `null`), plus `workingAt` / `handledAt` the phone's ticks read
  (`packages/web/src/components/Ticks.tsx`: `deliveredAt` is the "received" tick).
- `Board.listenForJames` streams comments where `agentId == <this agent>` and
  `deliveredAt == null`, ordered by `createdAt`; `index.ts` pushes each through
  `notifications/claude/channel`, then `markDelivered` sets `deliveredAt` and clears the task's
  question in one transaction. The composite index `comments (agentId, deliveredAt, createdAt)`
  is declared.
- `Board.startTask` reroutes undelivered comments on the task to the new agent.
- The agent finds its service-account key through `firestore.ts` (`KANBAN_SA`,
  `../kanban-secrets/sa.json`, `%APPDATA%\kanban\sa.json`) or the emulator; a watcher uses the
  same module, so no key is copied anywhere.
- Claude Code runs a background command until it exits and then wakes the session, even an
  idle desktop-app session (seen on 6 November: a background `gcloud` command woke this idle
  session when it finished).

**R1 contract details fixed at test time** (planner decisions; exact names tests may assert)

- **Shared constant** (`packages/shared/src/index.ts`, exported): `WATCHER_SETTLE_MS` = 1000.
  Once a watcher sees a first reply it waits this long, then claims and prints every reply
  pending at that moment, so replies sent together come out together.
- **Watcher command** — `packages/agent/src/wait.ts`, run as
  `node "<absolute path of wait.ts, forward slashes>" --agent <agentId>`. It reaches the board
  exactly as the agent does (`firestore.ts`: emulator when `FIRESTORE_EMULATOR_HOST` is set,
  else the service-account key), never registers as an agent and never writes to `agents`.
  - **Arguments**: exactly one `--agent` followed by an id of 1–64 characters from
    `[A-Za-z0-9_-]`. Anything else: one stdout line starting `kanban watcher: invalid arguments`,
    exit code 2, no board access.
  - **A reply** is a comment with `agentId` equal to the given id, `author` `james` and
    `deliveredAt` `null`.
  - **Success**: if replies are pending at start, or once one arrives, it waits
    `WATCHER_SETTLE_MS`, claims every pending reply and prints one line per claimed reply, oldest
    first by `createdAt`, then exits 0. Each line is compact JSON with exactly these keys in this
    order: `{"task":<taskId>,"kind":<"comment"|"answer">,"id":<comment id>,"from":"james","text":<body verbatim>}`.
    Nothing else goes to stdout (diagnostics go to stderr). If every pending reply was claimed by
    another watcher in the meantime, it goes back to waiting instead of exiting.
  - **Claiming** a reply is one transaction: re-read the comment; if its `deliveredAt` is already
    set, it is not this watcher's; otherwise set `deliveredAt` to now and apply today's question
    rule (when the reply's kind is `answer` or the task's `needs.kind` is `question`, the task's
    `needs` becomes `null`; the task's `updatedAt` is set either way). Only claimed replies are
    printed, so across any number of watchers each reply is printed once.
  - **Failures**: one stdout line, then exit 1, and a `logFailure` `WARNING` `api_call_failed`:
    - board offline (no emulator, no key): `kanban watcher: board offline: <detail>`
      (`target: 'firestore'`, `status: 'offline'`);
    - no `agents/<id>` document: `kanban watcher: unknown session <id>` (`target: 'watcher'`,
      `status: 'unknown_session'`);
    - the agent document's `lastSeen` is `0` (the agent shut down), at start or at any moment
      while waiting: `kanban watcher: session <id> has shut down` (`target: 'watcher'`,
      `status: 'shut_down'`);
    - a Firestore listener error or a failed claim: `kanban watcher: board error: <message>`
      (`target: 'firestore'`, `status`: the error's code or `unknown`).
- **Task results**: the results of `kanban_create_task` and `kanban_start_task` keep every field
  they have today and add `watcher`: the exact watcher command string for this session's agent
  id (the agent that answered the call).
- **Agent delivery**: the agent sends no `notifications/claude/channel` for James's comments or
  answers and never sets `deliveredAt` on a James comment (except through the new tool below).
  Queued-task announcements are unchanged. `Board.startTask` still reroutes a task's undelivered
  comments to the agent that starts it.
- **New tool `kanban_answered_in_session`**, arguments `{ task_id: string, answer: string }`, both
  required; `answer` is trimmed and must be 1–2000 characters (else a tool error whose text
  starts `invalid answer`).
  - The task must be bound to this session (else the existing "not bound to this session" tool
    error) and must have an open question (`needs.kind` is `question`; else a tool error whose
    text starts `no open question`).
  - Effect, in one batch: the task's `needs` becomes `null` and `updatedAt` now; a session
    comment (author `session`, kind `info`, `deliveredAt` set like every session comment) with
    body `James answered in the session: <answer>`; and every James comment of kind `answer` on
    that task whose `deliveredAt` is `null` gets `deliveredAt` now, so no watcher prints it.
  - Result: `{ "id": <the new comment's id> }`.
- **Instructions** (`SESSION_INSTRUCTIONS`): no longer say James's replies arrive as channel
  events; they tell the session that the `watcher` command from `kanban_create_task` /
  `kanban_start_task` must be started as a background command (Claude Code's
  `run_in_background`), that each line it prints is James's own words (treated exactly like
  something he typed), that it must be started again after each reply is handled, and that an
  answer James gives in the session's chat to an open board question is recorded with
  `kanban_answered_in_session`. The `kanban_ask` tool's description and result note say the
  answer arrives through the watcher.

## Files & modules affected

- New `packages/agent/src/wait.ts` — the watcher command.
- `packages/agent/src/board.ts` — claiming replies (shared by the watcher), recording an answer
  given in the session; the agent's listener stops delivering replies.
- `packages/agent/src/index.ts` — the watcher command in task results, the new tool, no channel
  push of replies.
- `packages/agent/src/instructions.ts` — the watcher and the new tool.
- `docs/architecture.md`, `DESIGN.md`, `AGENTS.md` (the channel-option gotcha), a new ADR
  `docs/decisions/0005-replies-by-watcher.md`.

## Principles that apply

- `io-validation` — the watcher's arguments and the new tool's arguments are validated.
- `idempotency` — a reply is claimed in a transaction, so it is printed and marked once even
  with two watchers.
- `graceful-degradation` — a watcher that cannot reach the board fails loudly at once instead
  of waiting forever; a reply that is not picked up stays waiting, not lost.
- `observability` — watcher failures are stored with `logFailure` so `kanban_logs` shows them.
- `error-schema` — tool errors keep the existing `BoardError` shape.

## Instrumentation

No new event types. A watcher that cannot reach the board, or a claim that fails, stores a
`WARNING` `api_call_failed` with `target: 'firestore'` (or `'watcher'` for an unknown or
shut-down session) and `status`, through the existing `logFailure`.

## Task class reasoning

Medium: one behaviour across the agent package, but it changes a shared contract (how every
session receives James's words and what "received" means) and a write path (`deliveredAt`), both
never-downshift triggers.

## Open questions

- How long Claude Code lets a background command run: confirm a watcher survives at least a
  few hours idle in a desktop-app session before relying on it (checked during build; if there
  is a cap, the watcher exits just before it with a "start me again" line).

## Repository sources (observed, verbatim)

### vitest.rules.config.ts

```ts
import { defineConfig } from 'vitest/config'

// Firestore emulator suites. Run only inside the emulator:
//   npm run test:rules   →  firebase emulators:exec --only firestore "vitest run --config vitest.rules.config.ts"
// tests/rules: security rules from browser principals. tests/emulator: the web data layer
// (packages/web/src/data.ts) writing to the emulator as James, with firebase.ts and the logger
// mocked. Needs Java 21 for the emulator (Documents\tools\jdk-21 on the desktop; preinstalled
// on GitHub's ubuntu runners). FIRESTORE_EMULATOR_HOST is set by emulators:exec.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/rules/**/*.test.ts', 'tests/emulator/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
```

### package.json

```json
{
  "name": "kanban",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "agent": "npm run start -w @kanban/agent",
    "web": "npm run dev -w @kanban/web",
    "build:web": "npm run build -w @kanban/web",
    "typecheck": "npm run typecheck -w @kanban/agent && npm run typecheck -w @kanban/web && tsc -p tsconfig.json",
    "test": "vitest run",
    "test:rules": "firebase emulators:exec --only firestore --project demo-kanban \"vitest run --config vitest.rules.config.ts\"",
    "test:agent": "npm run test -w @kanban/agent",
    "lint": "eslint .",
    "audit": "node scripts/check-audit.mjs",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky",
    "emulators": "firebase emulators:start --only firestore,auth --project demo-kanban",
    "deploy": "npm run build:web && firebase deploy"
  },
  "lint-staged": {
    "tests/**/*.{ts,tsx}": ["eslint"],
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{js,mjs,cjs}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml,css}": ["prettier --write"]
  },
  "devDependencies": {
    "@commitlint/cli": "^19.8.0",
    "@commitlint/config-conventional": "^19.8.0",
    "@eslint/js": "^9.30.0",
    "@firebase/rules-unit-testing": "^5.0.2",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.8",
    "@types/node": "^24.0.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "eslint": "^9.30.0",
    "eslint-config-prettier": "^10.1.0",
    "eslint-plugin-jsx-a11y": "^6.10.2",
    "eslint-plugin-react-hooks": "^5.2.0",
    "firebase-tools": "^14.0.0",
    "globals": "^16.3.0",
    "husky": "^9.1.7",
    "jsdom": "^26.1.0",
    "lint-staged": "^16.1.0",
    "prettier": "^3.6.0",
    "typescript": "^5.9.0",
    "typescript-eslint": "^8.38.0",
    "vitest": "^3.2.7"
  }
}
```

### packages/agent/package.json

```json
{
  "name": "@kanban/agent",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "start": "node src/index.ts",
    "typecheck": "tsc -p tsconfig.json",
    "test": "node test/protocol.ts"
  },
  "dependencies": {
    "@kanban/shared": "*",
    "@modelcontextprotocol/sdk": "^1.20.0",
    "firebase-admin": "^13.5.0",
    "yaml": "^2.9.1"
  }
}
```

### packages/shared/src/index.ts

```ts
// Shared types for the kanban board. Plain TypeScript, no enums/namespaces:
// Node 24 runs this file directly with type stripping, and Vite bundles it for the web.
//
// Firestore layout (all top-level collections, numeric ms timestamps):
//   projects/{projectId}   agents/{agentId}   tasks/{taskId}   comments/{commentId}   todos/{todoId}

// Both addresses are James; Google reports whichever is primary on the signed-in account.
export const OWNER_EMAILS: readonly string[] = ['j@nullnoise.ai', 'james@nullnoise.ai']
export const OWNER_EMAIL = OWNER_EMAILS[0]
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email.toLowerCase())
}

import { stagesFor } from './templates.ts'

export const COLLECTIONS = {
  projects: 'projects',
  agents: 'agents',
  tasks: 'tasks',
  comments: 'comments',
  todos: 'todos',
} as const

export type Author = 'james' | 'agent'

export type TaskType = 'feature' | 'bugfix' | 'chore' | 'for_james'
export const TASK_TYPES: readonly TaskType[] = ['feature', 'bugfix', 'chore', 'for_james']

// A task moves along a fixed chain of stages per type (see stagesFor in templates.ts).
export type Stage =
  | 'spec'
  | 'approved'
  | 'build'
  | 'fix'
  | 'do'
  | 'pr'
  | 'merged'
  | 'main_ci'
  | 'after_deploy'
  | 'done'

export const STAGES: readonly Stage[] = [
  'spec',
  'approved',
  'build',
  'fix',
  'do',
  'pr',
  'merged',
  'main_ci',
  'after_deploy',
  'done',
]

// What James has to decide right now; the session sets it, his decision clears it.
export type NeedKind = 'spec' | 'question' | 'pr' | 'after_deploy'
export interface TaskNeed {
  kind: NeedKind
  question?: string
  options?: { key: string; label: string }[]
}

export interface TaskSpec {
  goal: string
  points: string[]
  out: string
  touches: string
  version: number
}

export interface TaskPr {
  number: number
  url: string
}

export type LogWho = 'james' | 'session' | 'system'
export interface LogEntry {
  at: number
  who: LogWho
  text: string
}

// Comments split by author: James writes the first six kinds, the session the other seven.
export const JAMES_COMMENT_KINDS = [
  'comment',
  'answer',
  'approve',
  'change_request',
  'merged',
  'reopen',
] as const
export type JamesCommentKind = (typeof JAMES_COMMENT_KINDS)[number]
export const SESSION_COMMENT_KINDS = [
  'spec',
  'question',
  'pr',
  'after_deploy',
  'done',
  'info',
  'system',
] as const
export type SessionCommentKind = (typeof SESSION_COMMENT_KINDS)[number]
export type CommentKind = JamesCommentKind | SessionCommentKind
export interface Project {
  id: string
  hostname: string
  cwd: string
  name: string // basename of cwd by default; editable in the UI
  createdAt: number
  updatedAt: number
}

export interface AgentDoc {
  id: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
  claudeSessionId: string | null // filled by the SessionStart hook when known
  startedAt: number
  lastSeen: number // heartbeat; online = now - lastSeen < AGENT_STALE_MS
}
// One heartbeat write per agent every five minutes keeps a fleet of always-on agents well
// inside Firestore's free daily write quota (30 s beats drained it on 2026-11-04). Stale is
// two missed beats plus margin, so a running session stays live throughout; the trade-off is
// that the live dot may lag a closed session by up to twelve minutes.
export const AGENT_HEARTBEAT_MS = 5 * 60 * 1000
export const AGENT_STALE_MS = 12 * 60 * 1000

export interface Task {
  id: string
  projectId: string
  agentId: string | null // the session currently bound to this task
  type: TaskType
  title: string
  description: string
  stage: Stage
  needs: TaskNeed | null // null (never absent) once James has decided
  spec: TaskSpec | null
  afterDeploy: string[] // steps James does by hand once merged and green
  afterDone: boolean[] // his ticks, parallel to afterDeploy
  pr: TaskPr | null
  summary: string // the session's running summary / final report
  createdBy: Author
  createdAt: number
  updatedAt: number
  doneAt: number | null
  reopenedAt: number | null
  unread: boolean // set by the session, cleared when James opens the thread
  working: boolean // the session is on it right now
  lastCommentAt: number | null
  log: LogEntry[] // decision history, append-only, capped at LOG_CAP (see appendLog)
}

export interface Comment {
  id: string
  taskId: string
  projectId: string
  agentId: string | null // denormalised from the task at write time; routing key for delivery
  author: Author
  kind: CommentKind
  body: string
  createdAt: number
  deliveredAt: number | null // null until the bound agent has pushed it into its session
  workingAt: number | null // agent-written: the session started on it (absent on older documents)
  handledAt: number | null // agent-written: the session answered it (absent on older documents)
}

export interface Todo {
  id: string
  projectId: string
  body: string
  link: string | null
  done: boolean
  sourceTaskId: string | null
  createdAt: number
  doneAt: number | null
}

// Deterministic project id from (hostname, cwd) so every agent on a machine agrees
// without a lookup. FNV-1a over the normalised path, plus a readable prefix.
export function projectIdFor(hostname: string, cwd: string): string {
  const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const base = norm.split('/').filter(Boolean).pop() ?? 'root'
  const slug =
    base
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'project'
  let h = 0x811c9dc5
  for (const ch of `${hostname.toLowerCase()}:${norm}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${slug}-${h.toString(16).padStart(8, '0')}`
}

export function projectNameFor(cwd: string): string {
  const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  return norm.split('/').filter(Boolean).pop() ?? cwd
}

export function isAgentOnline(agent: Pick<AgentDoc, 'lastSeen'>, now = Date.now()): boolean {
  return now - agent.lastSeen < AGENT_STALE_MS
}

// ---- stage model helpers (pure) ---------------------------------------------------

// Done tasks leave the lists this long after `doneAt`; nothing is deleted.
export const DONE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000
// The task's decision log keeps this many entries; the oldest move to tasks/{id}/log_archive.
export const LOG_CAP = 200
// A for_james task has no stage chain; it rests at this stage.
const FOR_JAMES_STAGE: Stage = 'do'

type StageShape = Pick<Task, 'type' | 'afterDeploy' | 'stage'>

export function isDone(task: Pick<Task, 'stage'>): boolean {
  return task.stage === 'done'
}

export function isTaskVisible(
  task: Pick<Task, 'stage' | 'doneAt'>,
  opts: { now?: number; showOlder?: boolean } = {}
): boolean {
  const { now = Date.now(), showOlder = false } = opts
  if (!isDone(task) || showOlder || task.doneAt === null) return true
  return now - task.doneAt <= DONE_VISIBLE_MS
}

// The task's own stage list (after_deploy is in it only when the task has steps).
export function taskStages(task: Pick<Task, 'type' | 'afterDeploy'>): Stage[] {
  return stagesFor(task.type, task.afterDeploy.length > 0)
}

// Position in the task's own stage list; -1 when the stage is not in it.
export function stageIndex(task: StageShape): number {
  return taskStages(task).indexOf(task.stage)
}

// Queued = still at the first stage and not yet bound to a session.
export function isQueued(task: StageShape & Pick<Task, 'agentId'>): boolean {
  return task.agentId === null && task.stage === taskStages(task)[0]
}

// The one classification both the agent's list order and the web's status words use.
export type TaskPhase = 'waiting_on_james' | 'done' | 'queued' | 'in_progress'

export function taskPhase(task: StageShape & Pick<Task, 'agentId' | 'needs'>): TaskPhase {
  if (task.needs) return 'waiting_on_james'
  if (isDone(task)) return 'done'
  return isQueued(task) ? 'queued' : 'in_progress'
}

// Appends one entry and returns the new log (the newest LOG_CAP entries) plus the overflow,
// oldest first, for the caller to move into tasks/{id}/log_archive. Never mutates its input.
export function appendLog(
  log: readonly LogEntry[],
  entry: LogEntry
): { log: LogEntry[]; archived: LogEntry[] } {
  const all = [...log, entry]
  const overflow = Math.max(0, all.length - LOG_CAP)
  return { log: all.slice(overflow), archived: all.slice(0, overflow) }
}

export type DeliveryState = 'sent' | 'delivered' | 'working' | 'handled'

// Tick state of one of James's comments from the agent's stamps. The latest stamp wins even
// when an earlier one is missing, so it never goes backwards; absent fields read like null.
export function deliveryState(
  c: Pick<Comment, 'deliveredAt' | 'workingAt' | 'handledAt'>
): DeliveryState {
  if (c.handledAt != null) return 'handled'
  if (c.workingAt != null) return 'working'
  if (c.deliveredAt != null) return 'delivered'
  return 'sent'
}

// Every field of a freshly created task, in the one shape both web and agent write.
export function initialTaskFields(input: {
  projectId: string
  type: TaskType
  title: string
  description: string
  createdBy: Author
  afterDeploy: string[]
  now: number
}): Omit<Task, 'id'> {
  return {
    projectId: input.projectId,
    agentId: null,
    type: input.type,
    title: input.title,
    description: input.description,
    stage: stagesFor(input.type, input.afterDeploy.length > 0)[0] ?? FOR_JAMES_STAGE,
    needs: null,
    spec: null,
    afterDeploy: input.afterDeploy,
    afterDone: input.afterDeploy.map(() => false),
    pr: null,
    summary: '',
    createdBy: input.createdBy,
    createdAt: input.now,
    updatedAt: input.now,
    doneAt: null,
    reopenedAt: null,
    unread: false,
    working: false,
    lastCommentAt: null,
    log: [],
  }
}

export * from './templates.ts'

// ---- App logs (docs/features/app-logs.md) ---------------------------------------------------

export const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const LOG_MESSAGE_MAX = 2000
export const LOG_CONTEXT_MAX_KEYS = 30
export const LOG_CONTEXT_VALUE_MAX = 1000
export const AGENT_LOG_MAX_PER_MINUTE = 20
export const LOGS_READ_DEFAULT_LIMIT = 50
export const LOGS_READ_MAX_LIMIT = 200
export const LOGS_READ_DEFAULT_MINUTES = 1440
export const LOGS_READ_MAX_MINUTES = 43200
export const LOGS_SCAN_MAX = 1000

export const LOG_SEVERITIES = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const
export type LogSeverity = (typeof LOG_SEVERITIES)[number]

// The fields the shared logger puts on one event (logging/logger.browser.js buildEvent).
export interface LoggerEvent {
  schema_version: number
  taxonomy_version: number
  timestamp: string
  severity: string
  app_id: string
  client_id: string | null
  env: string
  source: string
  event_type: string
  audience: string
  session_id: string
  trace_id: string | null
  user_id: string | null
  message: string
  context: Record<string, unknown>
}

// Cuts message and context to the stored limits (the rules refuse anything larger) and derives
// ts and request_id. `expireAt` is added by each side as its own Timestamp type.
export function boundedLogFields(
  e: Omit<LoggerEvent, 'session_id'> & { session_id: string | null }
) {
  const context: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(e.context).slice(0, LOG_CONTEXT_MAX_KEYS))
    context[key] = typeof value === 'string' ? value.slice(0, LOG_CONTEXT_VALUE_MAX) : value
  const ts = Date.parse(e.timestamp)
  const rid = e.context.request_id
  return {
    ...e,
    message: e.message.slice(0, LOG_MESSAGE_MAX),
    context,
    ts,
    request_id: typeof rid === 'string' ? rid : null,
  }
}
```

### packages/agent/src/firestore.ts

```ts
// Firebase Admin init for the desktop agent and hooks.
//
// Modes, decided once at import:
//   emulator        FIRESTORE_EMULATOR_HOST is set → no credentials needed
//   service_account KANBAN_SA, ../kanban-secrets/sa.json or %APPDATA%\kanban\sa.json → cert()
//   offline         neither → the MCP server still starts so the session is not
//                   broken; every board tool returns a clear error instead.
//
// stdout is the MCP transport: never console.log in this package, use log().

import { readFileSync, appendFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const here = dirname(fileURLToPath(import.meta.url))
export const pkgDir = join(here, '..')
const logFile = join(pkgDir, 'agent.log')
// agent.log is a convenience copy of stderr; if it cannot be written we say so once and
// keep going on stderr alone.
let logFileWritable = true

export function log(msg: string) {
  const line = `${new Date().toISOString()} [${process.pid}] ${msg}`
  console.error(line)
  if (!logFileWritable) return
  try {
    appendFileSync(logFile, line + '\n')
  } catch (err) {
    logFileWritable = false
    console.error(`agent.log not writable (${(err as Error).message}); logging to stderr only`)
  }
}

export type BoardMode = 'emulator' | 'service_account' | 'offline'

export class BoardOfflineError extends Error {
  constructor(detail: string) {
    super(`kanban board is offline: ${detail}`)
    this.name = 'BoardOfflineError'
  }
}

let db: Firestore | null = null
let mode: BoardMode = 'offline'
let detail = 'not initialised'

// Candidate key locations, first readable wins. The Claude desktop app is an MSIX
// package, and processes it starts see a virtualised %APPDATA%\Roaming (a file there
// is ENOENT from another context), so the canonical place is a sibling folder of this
// repo: `../kanban-secrets/sa.json` (outside git). %APPDATA% stays as a fallback.
function saCandidates(): string[] {
  const appData = process.env.APPDATA ?? join(process.env.HOME ?? '', '.config')
  return [
    process.env.KANBAN_SA,
    join(pkgDir, '..', '..', '..', 'kanban-secrets', 'sa.json'),
    join(appData, 'kanban', 'sa.json'),
  ].filter((p): p is string => !!p)
}

function findSa(): { path: string | null; tried: string[] } {
  const tried: string[] = []
  for (const p of saCandidates()) {
    try {
      statSync(p)
      return { path: p, tried }
    } catch (e) {
      tried.push(`${p} (${(e as NodeJS.ErrnoException).code ?? 'error'})`)
    }
  }
  return { path: null, tried }
}

function init() {
  try {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const projectId = process.env.KANBAN_PROJECT_ID ?? 'demo-kanban'
      if (getApps().length === 0) initializeApp({ projectId })
      db = getFirestore()
      mode = 'emulator'
      detail = `${process.env.FIRESTORE_EMULATOR_HOST} project=${projectId}`
      return
    }
    const { path, tried } = findSa()
    if (!path) {
      detail = `no service account key; tried ${tried.join(', ')} (user=${process.env.USERNAME ?? '?'}); FIRESTORE_EMULATOR_HOST unset`
      return
    }
    const sa = JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount & { project_id?: string }
    if (getApps().length === 0) initializeApp({ credential: cert(sa), projectId: sa.project_id })
    db = getFirestore()
    mode = 'service_account'
    detail = `project=${sa.project_id} via ${path}`
  } catch (err) {
    db = null
    mode = 'offline'
    detail = `init failed: ${(err as Error).message}`
  }
}

init()
log(`firestore mode=${mode} ${detail}`)

export function boardStatus(): { mode: BoardMode; detail: string } {
  return { mode, detail }
}

export function getDb(): Firestore {
  if (!db) throw new BoardOfflineError(detail)
  return db
}
```

### packages/agent/src/app-log.ts

```ts
// App logs on the agent side (docs/features/app-logs.md): `logFailure` stores a failure in the
// board's `logs` collection next to its stderr / agent.log line, and `readLogs` backs the
// kanban_logs tool. Logging never blocks or breaks the agent: nothing here rejects, and a failed
// store is reported on stderr only, never stored (so it can never recurse).
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Timestamp, type Query } from 'firebase-admin/firestore'
import { parse as parseYaml } from 'yaml'
import {
  AGENT_LOG_MAX_PER_MINUTE,
  LOGS_READ_DEFAULT_LIMIT,
  LOGS_READ_DEFAULT_MINUTES,
  LOGS_READ_MAX_LIMIT,
  LOGS_READ_MAX_MINUTES,
  LOGS_SCAN_MAX,
  LOG_RETENTION_MS,
  LOG_SEVERITIES,
  boundedLogFields,
  type LogSeverity,
} from '@kanban/shared'
import { boardStatus, getDb, log } from './firestore.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LOGS = 'logs'
const MINUTE_MS = 60_000
const SCHEMA_VERSION = 1
const SOURCES = ['web_client', 'server'] as const
type Source = (typeof SOURCES)[number]

export interface FailureInput {
  severity: 'WARNING' | 'ERROR'
  event_type: 'api_call_failed' | 'feature_error'
  message: string
  context?: Record<string, string | number | boolean | null>
  request_id?: string
}

// ---- identity -------------------------------------------------------------------------------

interface AppIdentity {
  app_id: string
  client_id: string | null
  taxonomy_version: number
}
let identity: AppIdentity | null = null

// app.manifest.yaml and logging/taxonomy.json, read once, relative to this file.
function appIdentity(): AppIdentity {
  if (identity) return identity
  const manifest = parseYaml(readFileSync(join(REPO_ROOT, 'app.manifest.yaml'), 'utf8')) as {
    app_id: string
    client_id?: string | null
  }
  const taxonomy = JSON.parse(
    readFileSync(join(REPO_ROOT, 'logging', 'taxonomy.json'), 'utf8')
  ) as { taxonomy_version: number }
  identity = {
    app_id: manifest.app_id,
    client_id: manifest.client_id ?? null,
    taxonomy_version: taxonomy.taxonomy_version,
  }
  return identity
}

// Set by the board once registration completes; before that events carry no agent or project.
let registered: { agentId: string; projectId: string } | null = null
export function setLogIdentity(agentId: string, projectId: string): void {
  registered = { agentId, projectId }
}

// What an error says about itself: its `code` when it has one, else 'unknown'.
export function errorStatus(err: unknown): string | number {
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' || typeof code === 'number' ? code : 'unknown'
}

// ---- storing --------------------------------------------------------------------------------

const storedAt: number[] = [] // Date.now() of each stored event inside the rolling minute

// Claims one slot of the per-minute budget, or says there is none left.
function claimSlot(now: number): boolean {
  while (storedAt.length > 0 && storedAt[0] <= now - MINUTE_MS) storedAt.shift()
  if (storedAt.length >= AGENT_LOG_MAX_PER_MINUTE) return false
  storedAt.push(now)
  return true
}

async function store(input: FailureInput, now: number): Promise<void> {
  const app = appIdentity()
  const fields = boundedLogFields({
    schema_version: SCHEMA_VERSION,
    taxonomy_version: app.taxonomy_version,
    timestamp: new Date(now).toISOString(),
    severity: input.severity,
    app_id: app.app_id,
    client_id: app.client_id,
    env: process.env.APP_ENV || 'prod',
    source: 'server',
    event_type: input.event_type,
    audience: 'internal',
    session_id: registered?.agentId ?? null,
    trace_id: null,
    user_id: null,
    message: input.message,
    context: {
      ...input.context,
      ...(registered ? { agent_id: registered.agentId, project_id: registered.projectId } : {}),
    },
  })
  await getDb()
    .collection(LOGS)
    .add({
      ...fields,
      expireAt: Timestamp.fromMillis(fields.ts + LOG_RETENTION_MS),
      request_id: input.request_id ?? `agent-${randomUUID()}`,
    })
}

export async function logFailure(input: FailureInput): Promise<void> {
  log(`${input.event_type} ${input.severity}: ${input.message}`)
  const now = Date.now()
  if (boardStatus().mode === 'offline' || !claimSlot(now)) return
  try {
    await store(input, now)
  } catch (err) {
    // Only a line on stderr: a log about failing to store a log must never be stored.
    log(`storing a log event failed: ${(err as Error).message}`)
    // Give this call's own slot back: a write that never landed is not a stored event. Later
    // calls may have pushed entries meanwhile, so remove ours rather than popping the last.
    const i = storedAt.lastIndexOf(now)
    if (i !== -1) storedAt.splice(i, 1)
  }
}

// ---- reading --------------------------------------------------------------------------------

export class InvalidLogArgError extends Error {
  constructor(name: string, why: string) {
    super(`invalid ${name}: ${why}`)
    this.name = 'InvalidLogArgError'
  }
}

interface ReadQuery {
  request_id?: string
  min_severity: LogSeverity
  since_minutes?: number
  source?: Source
  limit: number
}

const READ_ARGS = ['request_id', 'min_severity', 'since_minutes', 'source', 'limit']

function intArg(args: Record<string, unknown>, name: string, max: number): number | undefined {
  const v = args[name]
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max)
    throw new InvalidLogArgError(name, `an integer from 1 to ${max}`)
  return v
}

function parseReadArgs(args: Record<string, unknown>): ReadQuery {
  for (const name of Object.keys(args))
    if (!READ_ARGS.includes(name)) throw new InvalidLogArgError(name, 'unknown argument')
  const { request_id, min_severity, source } = args
  if (request_id !== undefined && (typeof request_id !== 'string' || request_id === ''))
    throw new InvalidLogArgError('request_id', 'a non-empty string')
  if (min_severity !== undefined && !LOG_SEVERITIES.includes(min_severity as LogSeverity))
    throw new InvalidLogArgError('min_severity', `one of ${LOG_SEVERITIES.join(', ')}`)
  if (source !== undefined && !SOURCES.includes(source as Source))
    throw new InvalidLogArgError('source', `one of ${SOURCES.join(', ')}`)
  return {
    request_id,
    min_severity: (min_severity as LogSeverity | undefined) ?? (request_id ? 'DEBUG' : 'WARNING'),
    since_minutes: intArg(args, 'since_minutes', LOGS_READ_MAX_MINUTES),
    source: source as Source | undefined,
    limit: intArg(args, 'limit', LOGS_READ_MAX_LIMIT) ?? LOGS_READ_DEFAULT_LIMIT,
  }
}

interface StoredLog {
  timestamp: string
  severity: string
  event_type: string
  source: string
  message: string
  request_id: string | null
  context: Record<string, unknown>
}

export async function readLogs(args: Record<string, unknown>) {
  const q = parseReadArgs(args)
  // A trail (a request id) has no time bound unless asked for; a search defaults to a day.
  const minutes = q.since_minutes ?? (q.request_id ? undefined : LOGS_READ_DEFAULT_MINUTES)
  let query: Query = getDb().collection(LOGS)
  if (q.request_id) query = query.where('request_id', '==', q.request_id)
  if (minutes !== undefined) query = query.where('ts', '>=', Date.now() - minutes * MINUTE_MS)
  // A trail reads oldest first, a search newest first.
  const snap = await query
    .orderBy('ts', q.request_id ? 'asc' : 'desc')
    .limit(LOGS_SCAN_MAX)
    .get()
  const floor = LOG_SEVERITIES.indexOf(q.min_severity)
  const events = snap.docs
    .map((d) => d.data() as StoredLog)
    .filter(
      (e) =>
        LOG_SEVERITIES.indexOf(e.severity as LogSeverity) >= floor &&
        (!q.source || e.source === q.source)
    )
    .slice(0, q.limit)
    .map((e) => ({
      time: e.timestamp,
      severity: e.severity,
      event_type: e.event_type,
      source: e.source,
      message: e.message,
      request_id: e.request_id,
      context: e.context,
    }))
  return { events }
}
```

### packages/agent/src/board.ts

```ts
// All Firestore reads/writes for one agent (= one Claude Code session).
import { hostname as osHostname } from 'node:os'
import {
  FieldValue,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
  type WriteBatch,
} from 'firebase-admin/firestore'
import {
  AGENT_HEARTBEAT_MS,
  COLLECTIONS as C,
  TASK_TYPES,
  forJamesTaskId,
  initialTaskFields,
  isAgentOnline,
  isDone,
  isQueued,
  projectIdFor,
  projectNameFor,
  taskPhase,
  taskStages,
  type AgentDoc,
  type Comment,
  type NeedKind,
  type Project,
  type SessionCommentKind,
  type Stage,
  type Task,
  type TaskNeed,
  type TaskPhase,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { errorStatus, logFailure, setLogIdentity } from './app-log.ts'
import { getDb, log } from './firestore.ts'

// A Firestore-side failure of a listener or batch: the stderr / agent.log line, plus a stored
// event (WARNING for a batch, ERROR for a dead listener).
function firestoreFailure(
  severity: 'WARNING' | 'ERROR',
  what: string,
  err: Error,
  taskId?: string
) {
  log(`${what}: ${err.message}`)
  void logFailure({
    severity,
    event_type: 'api_call_failed',
    message: err.message,
    context: {
      target: 'firestore',
      status: errorStatus(err),
      ...(taskId ? { task_id: taskId } : {}),
    },
  })
}

export class BoardError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'BoardError'
  }
}

// ---- Phase 1 tool compatibility ------------------------------------------------
// The ten tools keep their shape in B1; these map their old vocabulary onto stage/needs.
// DESIGN.md Phase 2 package 2 replaces the mapping with the four-moment tools.

export type SubtaskStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'done' | 'skipped'
export const SUBTASK_STATUSES: readonly SubtaskStatus[] = [
  'pending',
  'in_progress',
  'awaiting_approval',
  'done',
  'skipped',
]
// kanban_update_task still accepts these two; every other Phase 1 status is retired.
export type UpdateStatus = 'in_progress' | 'done'
export const UPDATE_STATUSES: readonly UpdateStatus[] = ['in_progress', 'done']

// Step keys sessions used before stages existed.
const LEGACY_STEP_KEYS: Partial<Record<string, Stage>> = {
  spec_approved: 'approved',
  implement: 'build',
  pr_open: 'pr',
  reproduce: 'fix',
}
// The decision a stage waits on; finishing the stage clears a need of that kind.
const NEED_OF_STAGE: Partial<Record<Stage, NeedKind>> = {
  spec: 'spec',
  pr: 'pr',
  after_deploy: 'after_deploy',
}

function now() {
  return Date.now()
}

function asTask(snap: DocumentSnapshot): Task | null {
  return snap.exists ? taskOf(snap) : null
}
// Documents that come out of a query always exist.
function taskOf(snap: DocumentSnapshot): Task {
  return { ...(snap.data() as Omit<Task, 'id'>), id: snap.id }
}

export interface BoardIdentity {
  agentId: string
  projectId: string
  hostname: string
  cwd: string
  pid: number
}

export class Board {
  readonly db: Firestore
  readonly id: BoardIdentity
  private heartbeat: NodeJS.Timeout | null = null

  constructor(cwd = process.cwd()) {
    this.db = getDb()
    const hostname = osHostname()
    this.id = {
      agentId: this.db.collection(C.agents).doc().id,
      projectId: projectIdFor(hostname, cwd),
      hostname,
      cwd,
      pid: process.pid,
    }
  }

  // ---- lifecycle ------------------------------------------------------------

  async register(): Promise<void> {
    const t = now()
    const { agentId, projectId, hostname, cwd, pid } = this.id
    const projectRef = this.db.collection(C.projects).doc(projectId)
    const forJamesRef = this.db.collection(C.tasks).doc(forJamesTaskId(projectId))
    const [projectSnap, forJamesSnap] = await this.db.getAll(projectRef, forJamesRef)

    const batch = this.db.batch()
    if (!projectSnap.exists) {
      const project: Omit<Project, 'id'> = {
        hostname,
        cwd,
        name: projectNameFor(cwd),
        createdAt: t,
        updatedAt: t,
      }
      batch.set(projectRef, project)
    } else {
      batch.update(projectRef, { updatedAt: t })
    }
    if (!forJamesSnap.exists) {
      const task = initialTaskFields({
        projectId,
        type: 'for_james',
        title: 'For James',
        description: 'Things James has to do by hand for this project.',
        createdBy: 'james',
        afterDeploy: [],
        now: t,
      })
      batch.set(forJamesRef, task)
    }
    const agent: Omit<AgentDoc, 'id'> = {
      projectId,
      hostname,
      cwd,
      pid,
      claudeSessionId: null,
      startedAt: t,
      lastSeen: t,
    }
    batch.set(this.db.collection(C.agents).doc(agentId), agent)
    await batch.commit()
    setLogIdentity(agentId, projectId)

    this.heartbeat = setInterval(() => {
      this.db
        .collection(C.agents)
        .doc(agentId)
        .update({ lastSeen: now() })
        .catch((err: Error) => {
          log(`heartbeat failed: ${err.message}`)
          void logFailure({
            severity: 'WARNING',
            event_type: 'api_call_failed',
            message: err.message,
            context: { target: 'firestore', status: errorStatus(err) },
          })
        })
    }, AGENT_HEARTBEAT_MS)
    log(`registered agent=${agentId} project=${projectId} cwd=${cwd}`)
  }

  // Mark this agent gone and its active tasks orphaned (agentId kept so a new
  // session can resume them with kanban_start_task).
  async shutdown(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    await orphanAgent(this.db, this.id.agentId)
  }

  // ---- reads ----------------------------------------------------------------

  async listTasks(stage?: Stage): Promise<Task[]> {
    let q = this.db.collection(C.tasks).where('projectId', '==', this.id.projectId)
    if (stage) q = q.where('stage', '==', stage)
    const snap = await q.orderBy('updatedAt', 'desc').limit(100).get()
    return snap.docs
      .map(taskOf)
      .sort((a, b) => listRank(a) - listRank(b) || b.updatedAt - a.updatedAt)
  }

  async getTask(taskId: string): Promise<Task> {
    const task = asTask(await this.db.collection(C.tasks).doc(taskId).get())
    if (!task) throw new BoardError(`no task ${taskId}`)
    if (task.projectId !== this.id.projectId)
      throw new BoardError(`task ${taskId} belongs to another project`)
    return task
  }

  async getComments(taskId: string, limit = 30): Promise<Comment[]> {
    const snap = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    return snap.docs.map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id })).reverse()
  }

  // ---- task writes ----------------------------------------------------------

  async createTask(input: { title: string; type: TaskType; description?: string }): Promise<Task> {
    if (!TASK_TYPES.includes(input.type) || input.type === 'for_james') {
      throw new BoardError(`type must be one of feature, bugfix, chore`)
    }
    const t = now()
    const ref = this.db.collection(C.tasks).doc()
    const task: Omit<Task, 'id'> = {
      ...initialTaskFields({
        projectId: this.id.projectId,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        createdBy: 'agent',
        afterDeploy: [],
        now: t,
      }),
      agentId: this.id.agentId,
      working: true,
    }
    await ref.set(task)
    log(`created task ${ref.id} "${task.title}"`)
    return { ...task, id: ref.id }
  }

  async startTask(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId)
    if (isDone(task)) throw new BoardError(`task ${taskId} is done; create a new one`)
    if (task.agentId && task.agentId !== this.id.agentId) {
      const other = (await this.db.collection(C.agents).doc(task.agentId).get()).data() as
        AgentDoc | undefined
      if (other && isAgentOnline(other)) {
        throw new BoardError(
          `task ${taskId} is being worked on by another live session (agent ${task.agentId}, pid ${other.pid})`
        )
      }
      log(`taking over task ${taskId} from stale agent ${task.agentId}`)
    }
    const t = now()
    const batch = this.db.batch()
    const bound = { agentId: this.id.agentId, working: true, updatedAt: t }
    batch.update(this.db.collection(C.tasks).doc(taskId), bound)
    // Route any undelivered comments on this task to us so they flow through the listener.
    const pending = await this.db
      .collection(C.comments)
      .where('taskId', '==', taskId)
      .where('deliveredAt', '==', null)
      .get()
    for (const d of pending.docs) {
      if (d.get('agentId') !== this.id.agentId) batch.update(d.ref, { agentId: this.id.agentId })
    }
    await batch.commit()
    log(`started task ${taskId} (${pending.size} pending comments rerouted)`)
    return { ...task, ...bound }
  }

  async updateTask(input: {
    task_id: string
    status?: UpdateStatus
    summary?: string
    pr_url?: string
    title?: string
  }): Promise<Task> {
    const task = await this.getTask(input.task_id)
    this.assertMine(task)
    if (input.status && !UPDATE_STATUSES.includes(input.status))
      throw new BoardError(`status must be one of ${UPDATE_STATUSES.join(', ')}`)
    const t = now()
    const patch: Record<string, unknown> = { updatedAt: t }
    if (input.summary !== undefined) patch.summary = input.summary
    if (input.title) patch.title = input.title.trim()
    if (input.pr_url !== undefined) Object.assign(patch, prPatch(task, input.pr_url))
    if (input.status === 'in_progress') patch.needs = null
    if (input.status === 'done' && !isDone(task)) {
      // Finishing: the Done message and the unread mark go in the same batch as the done patch.
      Object.assign(patch, donePatch(t), { unread: true })
      await this.writeAgentComment(task, input.summary?.trim() || DONE_BODY, 'done', patch)
    } else {
      await this.db.collection(C.tasks).doc(task.id).update(patch)
    }
    log(`updated task ${task.id}: ${Object.keys(patch).join(',')}`)
    return { ...task, ...(patch as Partial<Task>) }
  }

  // Phase 1 step API: `key` is a stage name (or a retired step key) of the task's own chain.
  async setSubtask(
    taskId: string,
    key: string,
    status: SubtaskStatus,
    note?: string
  ): Promise<Task> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const t = now()
    const patch = { updatedAt: t, ...subtaskPatch(task, resolveStage(task, key), status, t) }
    if (note) await this.writeAgentComment(task, note, 'info', patch)
    else await this.db.collection(C.tasks).doc(taskId).update(patch)
    return { ...task, ...(patch as Partial<Task>) }
  }

  // ---- comments -------------------------------------------------------------

  async comment(taskId: string, body: string, kind: SessionCommentKind = 'info'): Promise<Comment> {
    const task = await this.getTask(taskId)
    if (task.type !== 'for_james') this.assertMine(task)
    return this.writeAgentComment(task, body, kind)
  }

  async ask(taskId: string, question: string): Promise<Comment> {
    const task = await this.getTask(taskId)
    this.assertMine(task)
    const needs: TaskNeed = { kind: 'question', question }
    const c = await this.writeAgentComment(task, question, 'question', { needs })
    log(`asked on ${taskId}: ${question.slice(0, 80)}`)
    return c
  }

  async todoForJames(body: string, link?: string, sourceTaskId?: string): Promise<Todo> {
    const t = now()
    const ref = this.db.collection(C.todos).doc()
    const todo: Omit<Todo, 'id'> = {
      projectId: this.id.projectId,
      body: body.trim(),
      link: link || null,
      done: false,
      sourceTaskId: sourceTaskId ?? null,
      createdAt: t,
      doneAt: null,
    }
    await ref.set(todo)
    const forJames = await this.getTask(forJamesTaskId(this.id.projectId))
    await this.writeAgentComment(
      forJames,
      `New to-do: ${todo.body}${link ? ` (${link})` : ''}`,
      'system'
    )
    log(`todo for james: ${todo.body}`)
    return { ...todo, id: ref.id }
  }

  private async writeAgentComment(
    task: Task,
    body: string,
    kind: SessionCommentKind,
    taskPatch: Record<string, unknown> = {}
  ): Promise<Comment> {
    const t = now()
    const ref = this.db.collection(C.comments).doc()
    const c: Omit<Comment, 'id'> = {
      taskId: task.id,
      projectId: task.projectId,
      agentId: this.id.agentId,
      author: 'agent',
      kind,
      body: body.trim(),
      createdAt: t,
      deliveredAt: t, // our own words never come back to us
      workingAt: null,
      handledAt: null,
    }
    const batch = this.db.batch()
    batch.set(ref, c)
    batch.update(this.db.collection(C.tasks).doc(task.id), {
      lastCommentAt: t,
      updatedAt: t,
      ...taskPatch,
    })
    await batch.commit()
    return { ...c, id: ref.id }
  }

  // ---- inbound --------------------------------------------------------------

  // Streams James's undelivered comments for tasks bound to this agent. `deliver`
  // must push the event into the session; once it resolves we mark delivery and
  // clear the question James just answered.
  listenForJames(deliver: (c: Comment) => Promise<void>): () => void {
    const inflight = new Set<string>()
    const q = this.db
      .collection(C.comments)
      .where('agentId', '==', this.id.agentId)
      .where('deliveredAt', '==', null)
      .orderBy('createdAt', 'asc')
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const c: Comment = { ...(change.doc.data() as Omit<Comment, 'id'>), id: change.doc.id }
        if (c.author !== 'james' || inflight.has(c.id)) continue
        inflight.add(c.id)
        try {
          await deliver(c)
          await this.markDelivered(c)
          log(`delivered ${c.id} (${c.kind}) task=${c.taskId}`)
        } catch (err) {
          log(`delivery of ${c.id} failed: ${(err as Error).message}`)
          void logFailure({
            severity: 'WARNING',
            event_type: 'api_call_failed',
            message: (err as Error).message,
            context: { target: 'channel', status: 'failed', task_id: c.taskId },
          })
        } finally {
          inflight.delete(c.id)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) =>
          firestoreFailure('WARNING', `comment batch failed`, err)
        )
      },
      (err) => firestoreFailure('ERROR', 'comment listener error', err)
    )
  }

  // Streams tasks James queues from the board for this project (including ones queued
  // before this session started) so an idle session can pick them up. Each task is
  // announced once per session; binding is still an explicit kanban_start_task. Queued is
  // derived (first stage, no agent): the query narrows to unbound tasks, isQueued decides.
  listenForQueued(announce: (t: Task) => Promise<void>): () => void {
    const announced = new Set<string>()
    const q = this.db
      .collection(C.tasks)
      .where('projectId', '==', this.id.projectId)
      .where('agentId', '==', null)
    const onChanges = async (snap: QuerySnapshot) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') continue
        const t = taskOf(change.doc)
        if (!isQueued(t) || announced.has(t.id)) continue
        announced.add(t.id)
        try {
          await announce(t)
          log(`announced queued task ${t.id} "${t.title}"`)
        } catch (err) {
          announced.delete(t.id)
          firestoreFailure('WARNING', `announce of ${t.id} failed`, err as Error, t.id)
        }
      }
    }
    return q.onSnapshot(
      (snap) => {
        onChanges(snap).catch((err: Error) =>
          firestoreFailure('WARNING', `queued batch failed`, err)
        )
      },
      (err) => firestoreFailure('ERROR', 'queued listener error', err)
    )
  }

  private async markDelivered(c: Comment): Promise<void> {
    const t = now()
    const taskRef = this.db.collection(C.tasks).doc(c.taskId)
    await this.db.runTransaction(async (tx) => {
      const task = asTask(await tx.get(taskRef))
      tx.update(this.db.collection(C.comments).doc(c.id), { deliveredAt: t })
      if (!task) return
      const patch: Record<string, unknown> = { updatedAt: t }
      if (c.kind === 'answer' || task.needs?.kind === 'question') patch.needs = null
      tx.update(taskRef, patch)
    })
  }

  private assertMine(task: Task) {
    if (task.agentId !== this.id.agentId) {
      throw new BoardError(
        `task ${task.id} is not bound to this session; call kanban_start_task first`
      )
    }
  }
}

// Shared by Board.shutdown and the SessionEnd hook. The agent goes offline and its tasks stop
// being worked on; agentId stays so a new session can resume them with kanban_start_task.
export async function orphanAgent(db: Firestore, agentId: string): Promise<number> {
  const batch: WriteBatch = db.batch()
  batch.update(db.collection(C.agents).doc(agentId), { lastSeen: 0 })
  const active = await db
    .collection(C.tasks)
    .where('agentId', '==', agentId)
    .where('working', '==', true)
    .get()
  const t = now()
  for (const d of active.docs) batch.update(d.ref, { working: false, updatedAt: t })
  await batch.commit()
  log(`agent ${agentId} shut down; ${active.size} task(s) orphaned`)
  return active.size
}

// Most recent live agent for (hostname, cwd): how hooks find "their" session.
export async function findLiveAgent(
  db: Firestore,
  hostname: string,
  cwd: string
): Promise<(AgentDoc & { id: string }) | null> {
  const snap = await db
    .collection(C.agents)
    .where('hostname', '==', hostname)
    .where('cwd', '==', cwd)
    .get()
  const live = snap.docs
    .map((d) => ({ ...(d.data() as Omit<AgentDoc, 'id'>), id: d.id }))
    .filter((a) => isAgentOnline(a))
    .sort((a, b) => b.startedAt - a.startedAt)
  return live[0] ?? null
}

// Order in kanban_list_tasks: the pinned For James task, then what needs James, then work in
// flight, then queued, then done.
const PHASE_RANK: Record<TaskPhase, number> = {
  waiting_on_james: 0,
  in_progress: 1,
  queued: 2,
  done: 3,
}
function listRank(t: Task): number {
  return t.type === 'for_james' ? -1 : PHASE_RANK[taskPhase(t)]
}

// A step key from the tool is a stage of this task's chain, or a retired Phase 1 step key.
function resolveStage(task: Task, key: string): Stage {
  const wanted = LEGACY_STEP_KEYS[key] ?? key
  const stage = taskStages(task).find((s) => s === wanted)
  if (!stage) {
    const has = taskStages(task).join(', ') || 'none'
    throw new BoardError(`task ${task.id} has no step "${key}" (has: ${has})`)
  }
  return stage
}

// Finishing a task: done, stamped, unbound, nothing left for James to decide.
function donePatch(t: number): Record<string, unknown> {
  return { stage: 'done', doneAt: t, agentId: null, needs: null, working: false }
}

// The Done message's body when the session gives no summary.
const DONE_BODY = 'Done.'

// The stages in which a reported PR is the work's result, so the task then waits on James's
// merge decision: build (fix for a bugfix, do for a chore) and pr itself.
const PR_READY_FROM: readonly Stage[] = ['build', 'fix', 'do', 'pr']

// pr_url sets the PR (its number is the last number in the URL). From a build stage or pr it
// also moves the task to pr and makes it wait on James's merge; at an earlier or later stage it
// only records the PR. An empty url clears it.
function prPatch(task: Task, url: string): Record<string, unknown> {
  if (!url) return { pr: null }
  const number = /(\d+)\/?(?:[?#].*)?$/.exec(url)?.[1]
  if (!number) throw new BoardError('pr_url must end in the pull request number')
  const pr = { pr: { number: Number(number), url } }
  const ready = PR_READY_FROM.includes(task.stage) && taskStages(task).includes('pr')
  return ready ? { ...pr, stage: 'pr', needs: { kind: 'pr' } satisfies TaskNeed } : pr
}

// Moves the task past `stage`: to the next stage of its chain (done after the last), clearing
// the need of any stage it passes on the way (its current stage through `stage`). A task already
// beyond `stage` is left alone.
function advancePast(task: Task, stage: Stage, t: number): Record<string, unknown> {
  const chain = taskStages(task)
  const next = chain.at(chain.indexOf(stage) + 1)
  if (next === undefined || next === 'done') return donePatch(t)
  if (chain.indexOf(task.stage) > chain.indexOf(stage)) return {}
  const passed = chain.slice(Math.max(0, chain.indexOf(task.stage)), chain.indexOf(stage) + 1)
  const needKind = task.needs?.kind
  const stale = needKind !== undefined && passed.some((s) => NEED_OF_STAGE[s] === needKind)
  return { stage: next, ...(stale ? { needs: null } : {}) }
}

// What kanban_subtask changes on the task for each Phase 1 step status.
function subtaskPatch(
  task: Task,
  stage: Stage,
  status: SubtaskStatus,
  t: number
): Record<string, unknown> {
  switch (status) {
    case 'awaiting_approval':
      if (stage !== 'spec') throw new BoardError('awaiting_approval only applies to the spec step')
      return { needs: { kind: 'spec' } satisfies TaskNeed }
    case 'done':
    case 'skipped':
      return advancePast(task, stage, t)
    case 'in_progress': {
      const chain = taskStages(task)
      const ahead = stage !== 'done' && chain.indexOf(stage) > chain.indexOf(task.stage)
      return ahead ? { stage } : {}
    }
    case 'pending':
      return {}
  }
}

export { FieldValue }
```

### packages/agent/src/index.ts

```ts
#!/usr/bin/env node
// kanban-agent: a Claude Code *channel* MCP server, one per session.
//
// Claude Code spawns this over stdio when a session starts with
//   claude --dangerously-load-development-channels server:kanban
//
// Outbound: the kanban_* tools write to Firestore (projects/tasks/comments/todos).
// Inbound : James's comments on tasks bound to this agent arrive via onSnapshot
//           and are pushed into the session as <channel source="kanban" from="james">.
//
// stdout is the MCP transport. Never console.log here — use log().

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import {
  LOGS_READ_DEFAULT_LIMIT,
  LOGS_READ_DEFAULT_MINUTES,
  LOGS_READ_MAX_LIMIT,
  LOGS_READ_MAX_MINUTES,
  LOG_SEVERITIES,
  STAGES,
  type Comment,
  type Stage,
  type Task,
  type TaskType,
} from '@kanban/shared'
import {
  Board,
  BoardError,
  SUBTASK_STATUSES,
  UPDATE_STATUSES,
  type SubtaskStatus,
  type UpdateStatus,
} from './board.ts'
import { InvalidLogArgError, errorStatus, logFailure, readLogs } from './app-log.ts'
import { BoardOfflineError, boardStatus, log } from './firestore.ts'
import { SESSION_INSTRUCTIONS } from './instructions.ts'

const tools: Tool[] = [
  {
    name: 'kanban_list_tasks',
    description:
      'List tasks in this project, open ones first (the pinned "For James" task comes first).',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: [...STAGES],
          description: 'Only tasks at this stage',
        },
      },
    },
  },
  {
    name: 'kanban_get_task',
    description:
      'Full task (stage, what it needs from James, decision log) and the last 30 comments. Use before resuming a task from a previous session.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_create_task',
    description:
      'Create a task for the work this session is doing and bind it to this session. It starts at the first stage of its type.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative title, e.g. "Add CSV export"' },
        type: { type: 'string', enum: ['feature', 'bugfix', 'chore'] },
        description: { type: 'string', description: 'One paragraph of context' },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'kanban_start_task',
    description:
      'Bind an existing (queued or left-behind) task to this session. Refused if another live session owns it.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_update_task',
    description:
      'Update summary, PR link, title or status of a task bound to this session. status "done" finishes and releases the task; status "in_progress" clears whatever it was waiting on from James.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        status: { type: 'string', enum: [...UPDATE_STATUSES] },
        summary: { type: 'string', description: 'Running or final summary, a few sentences' },
        pr_url: { type: 'string', description: 'Pull request URL ending in its number' },
        title: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_subtask',
    description:
      'Advance one stage of the task (e.g. spec → awaiting_approval asks James to approve the spec; done moves the task to its next stage).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        key: {
          type: 'string',
          description:
            'Stage of the task: spec, approved, build, pr, merged, main_ci, after_deploy, done (feature); fix (bugfix); do (chore)',
        },
        status: {
          type: 'string',
          enum: [...SUBTASK_STATUSES],
        },
        note: { type: 'string', description: 'Posted to the thread as a short update' },
      },
      required: ['task_id', 'key', 'status'],
    },
  },
  {
    name: 'kanban_comment',
    description:
      'Post a short progress note on a task bound to this session. James reads it on his phone.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, body: { type: 'string' } },
      required: ['task_id', 'body'],
    },
  },
  {
    name: 'kanban_ask',
    description:
      'Ask James a question on a task. The task shows as needing him; his answer arrives as a <channel kind="answer"> event.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, question: { type: 'string' } },
      required: ['task_id', 'question'],
    },
  },
  {
    name: 'kanban_todo_for_james',
    description:
      'Add something James must do by hand to this project\'s "For James" list (merge PR, sign in, rotate key…).',
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        link: { type: 'string', description: 'URL to open, e.g. the PR' },
        task_id: { type: 'string', description: 'The task this came from' },
      },
      required: ['body'],
    },
  },
  {
    name: 'kanban_logs',
    description:
      'Read the board stored app logs (the phone app and this agent): warnings and worse from the last 24 hours, newest first, by default. Pass request_id for the full oldest-first trail of one operation (any severity, either source). Read this before asking James to reproduce a board problem.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'Every event of one operation, oldest first' },
        min_severity: { type: 'string', enum: [...LOG_SEVERITIES], description: 'Default WARNING' },
        since_minutes: {
          type: 'integer',
          minimum: 1,
          maximum: LOGS_READ_MAX_MINUTES,
          description: `Time window, default ${LOGS_READ_DEFAULT_MINUTES}`,
        },
        source: { type: 'string', enum: ['web_client', 'server'] },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LOGS_READ_MAX_LIMIT,
          description: `Default ${LOGS_READ_DEFAULT_LIMIT}`,
        },
      },
    },
  },
  {
    name: 'kanban_whoami',
    description:
      "This session's agent id, project id, working directory and board connection status.",
    inputSchema: { type: 'object', properties: {} },
  },
]

const mcp = new Server(
  { name: 'kanban', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: SESSION_INSTRUCTIONS,
  }
)

mcp.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))

// The board is created lazily on first use so an offline Firestore never prevents
// the MCP server from starting (the session would otherwise lose the server).
let board: Board | null = null
let boardInit: Promise<Board> | null = null
let stopListening: (() => void) | null = null

function getBoard(): Promise<Board> {
  if (board) return Promise.resolve(board)
  if (!boardInit) {
    boardInit = (async () => {
      const b = new Board()
      await b.register()
      const stopComments = b.listenForJames(deliverToSession)
      const stopQueued = b.listenForQueued(announceQueued)
      stopListening = () => {
        stopComments()
        stopQueued()
      }
      board = b
      return b
    })().catch((err: Error) => {
      boardInit = null
      if (!(err instanceof BoardOfflineError))
        void logFailure({
          severity: 'ERROR',
          event_type: 'api_call_failed',
          message: err.message,
          context: { target: 'firestore', status: errorStatus(err) },
        })
      throw err
    })
  }
  return boardInit
}

async function deliverToSession(c: Comment): Promise<void> {
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: c.body,
      meta: { task: c.taskId, id: c.id, from: 'james', kind: c.kind },
    },
  })
}

async function announceQueued(t: Task): Promise<void> {
  const desc = t.description ? `\n\n${t.description}` : ''
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content:
        `James queued a ${t.type} on the board: "${t.title}" (task ${t.id}).${desc}\n\n` +
        `If you are idle, call kanban_start_task with task_id "${t.id}" and begin. ` +
        `If you are in the middle of other work, or kanban_start_task says another session owns it, ignore this.`,
      meta: { task: t.id, from: 'board', kind: 'queued' },
    },
  })
}

function taskBrief(t: Task) {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    stage: t.stage,
    needs: t.needs,
    pr: t.pr ?? undefined,
    mine: t.agentId === board?.id.agentId || undefined,
  }
}

// Each tool's arguments as its inputSchema above declares them. Claude Code validates calls
// against those schemas before they reach us, so required fields are typed as present; the
// Board re-checks anything that matters (ids, statuses, ownership).
interface ToolArgs {
  kanban_list_tasks: { stage?: Stage }
  kanban_get_task: { task_id: string }
  kanban_create_task: { title: string; type: TaskType; description?: string }
  kanban_start_task: { task_id: string }
  kanban_update_task: {
    task_id: string
    status?: UpdateStatus
    summary?: string
    pr_url?: string
    title?: string
  }
  kanban_subtask: { task_id: string; key: string; status: SubtaskStatus; note?: string }
  kanban_comment: { task_id: string; body: string }
  kanban_ask: { task_id: string; question: string }
  kanban_todo_for_james: { body: string; link?: string; task_id?: string }
}
function argsOf<N extends keyof ToolArgs>(
  args: Record<string, unknown> | undefined,
  _tool: N
): ToolArgs[N] {
  return (args ?? {}) as ToolArgs[N]
}

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  try {
    if (name === 'kanban_whoami') {
      const status = boardStatus()
      const b = status.mode === 'offline' ? null : await getBoard().catch(() => null)
      return ok({ ...(b?.id ?? { cwd: process.cwd(), pid: process.pid }), board: status })
    }
    if (name === 'kanban_logs') return ok(await readLogs(args ?? {}))
    const b = await getBoard()
    switch (name) {
      case 'kanban_list_tasks': {
        const a = argsOf(args, name)
        return ok((await b.listTasks(a.stage)).map(taskBrief))
      }
      case 'kanban_get_task': {
        const a = argsOf(args, name)
        const task = await b.getTask(a.task_id)
        const comments = await b.getComments(a.task_id)
        return ok({
          ...task,
          comments: comments.map((c) => ({
            at: new Date(c.createdAt).toISOString(),
            author: c.author,
            kind: c.kind,
            body: c.body,
          })),
        })
      }
      case 'kanban_create_task': {
        const a = argsOf(args, name)
        return ok(
          taskBrief(
            await b.createTask({ title: a.title, type: a.type, description: a.description })
          )
        )
      }
      case 'kanban_start_task': {
        const a = argsOf(args, name)
        return ok(taskBrief(await b.startTask(a.task_id)))
      }
      case 'kanban_update_task':
        return ok(taskBrief(await b.updateTask(argsOf(args, name))))
      case 'kanban_subtask': {
        const a = argsOf(args, name)
        return ok(taskBrief(await b.setSubtask(a.task_id, a.key, a.status, a.note)))
      }
      case 'kanban_comment': {
        const a = argsOf(args, name)
        return ok({ id: (await b.comment(a.task_id, a.body)).id })
      }
      case 'kanban_ask': {
        const a = argsOf(args, name)
        return ok({
          id: (await b.ask(a.task_id, a.question)).id,
          note: 'James will see this on his phone; his answer arrives as a <channel kind="answer"> event.',
        })
      }
      case 'kanban_todo_for_james': {
        const a = argsOf(args, name)
        return ok({ id: (await b.todoForJames(a.body, a.link, a.task_id)).id })
      }
      default:
        throw new BoardError(`unknown tool: ${name}`)
    }
  } catch (err) {
    const e = err as Error
    if (
      !(e instanceof BoardError) &&
      !(e instanceof BoardOfflineError) &&
      !(e instanceof InvalidLogArgError)
    ) {
      log(`${name} failed: ${e.stack ?? e.message}`)
      void logFailure({
        severity: 'ERROR',
        event_type: 'feature_error',
        message: e.message,
        context: { feature: name },
      })
    }
    return { isError: true, content: [{ type: 'text', text: e.message }] }
  }
})

function ok(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] }
}

// ---- lifecycle ---------------------------------------------------------------

let shuttingDown = false
async function shutdown(reason: string) {
  if (shuttingDown) return
  shuttingDown = true
  log(`shutting down (${reason})`)
  try {
    stopListening?.()
  } catch (err) {
    log(`stopping listeners failed: ${(err as Error).message}`)
  }
  try {
    await board?.shutdown()
  } catch (err) {
    log(`shutdown bookkeeping failed: ${(err as Error).message}`)
  }
  process.exit(0)
}

const transport = new StdioServerTransport()
transport.onclose = () => void shutdown('stdio closed')
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.stdin.on('end', () => void shutdown('stdin end'))

await mcp.connect(transport)
log(`mcp connected cwd=${process.cwd()} board=${boardStatus().mode}`)

// Register eagerly when the board is reachable so James sees the session come
// online before Claude's first tool call; failures are logged and retried on use.
if (boardStatus().mode !== 'offline') {
  getBoard().catch((err) => log(`board registration failed: ${(err as Error).message}`))
}
```

### packages/agent/src/instructions.ts

```ts
// What a session is told when it connects: the MCP server's `instructions`. Plain text, so it
// is the one place the channel protocol and the board's reporting rules are written down.
// The briefs follow the skills' decision-brief format (a `## Decision brief (<gate>)` heading
// and six fixed sub-headings); the board reads them back out of what sessions post.

export const SESSION_INSTRUCTIONS = `
You are connected to James's kanban board through the "kanban" channel. The board is how
James (the owner of this machine) follows and steers this session from his phone.

INBOUND. Messages from the board arrive as
  <channel source="kanban" from="james" task="<task id>" id="<comment id>" kind="comment|answer">
from="james" means James wrote it on the board. Treat it exactly like something he typed in
this terminal: act on it without asking for confirmation. Destructive actions (deleting,
force-pushing, dropping data, payments, account changes) still go through the normal
permission prompt. kind="answer" is his reply to a question you asked with kanban_ask.
<channel source="kanban" from="board" kind="queued" task="..."> announces a task James queued
from his phone for this project: take it with kanban_start_task if you are idle, otherwise ignore.

WORKFLOW.
1. Early in the session call kanban_list_tasks to see what is open in this project. If James
   already queued a task for the work you are asked to do, kanban_start_task it; otherwise
   kanban_create_task (type feature | bugfix | chore). Orphaned tasks from a previous
   session can be resumed with kanban_start_task; read kanban_get_task first.
2. Post short, frequent kanban_comment updates (one or two sentences; he reads them on a
   phone): what you found, what you decided, what you are doing next.
3. Advance the task's stages with kanban_subtask; the key is a stage: spec, approved, build,
   pr, merged, main_ci, after_deploy, done (feature), fix instead of spec/approved/build (bugfix),
   do (chore). Marking a stage done moves the task to the next one. For a feature, write the
   spec first and set "spec" to awaiting_approval; that is how James is asked to approve it,
   so do not also kanban_ask. Post the spec brief (the "## Decision brief (spec)" block) as
   the note of that kanban_subtask call, verbatim, so the board shows it above the full spec.
   His approval arrives as a channel event: do not implement until
   it does (then mark "spec" and "approved" done). Use kanban_ask for real questions only, when
   something else needs his decision; keep working on anything that does not depend on it.
4. Gate briefs. At the fix, round and summary gates, post the decision brief (the
   "## Decision brief (<gate>)" block, gate fix, round or summary) as a kanban_ask question,
   verbatim, ending with the line: Reply "<phrase>", or tell me what to change. The phrase is
   the gate's own: "fix confirmed", "another round" or "ship it". The board turns that line
   into a one-tap button; his answer arrives as kind="answer".
5. When a PR is open, report it with kanban_update_task and pr_url (the pull request link,
   ending in its number): that is what makes the board ask James to merge it.
6. When everything is finished, call kanban_update_task with status "done" and a summary of
   what shipped: that posts your Done message to the thread. Write the summary as a summary
   brief when you have one. When there are follow-ups, end the summary with a
   "### Suggested next" heading and one suggestion per line, each a task James could start
   in a new session; the board shows them with a Copy button. Call it once.
7. Something wrong on the board (a tap that did nothing, a reply that never arrived)? Read
   kanban_logs before asking James to reproduce it: it returns the phone's and the agent's
   recent warnings and errors, or one operation's whole trail by request_id.
8. Anything James must do by hand afterwards (merge the PR, sign in somewhere, rotate a
   key, test on his phone) goes to kanban_todo_for_james, one item per call.
`.trim()
```

### packages/web/src/lib/messages.ts

```ts
// Pure helpers behind the thread's message list: how a comment is labelled, which session
// message carries Read more, and how James's not-yet-confirmed replies join the saved ones.
// No React, no Firestore.
import {
  TASK_TYPES,
  taskStages,
  type Comment,
  type CommentKind,
  type Stage,
  type Task,
  type TaskNeed,
} from '@kanban/shared'
import { MAX_COMMENT_CHARS } from './limits.ts'
import { isDateable, relativeTime } from './threads.ts'

const KIND_LABEL: Record<string, string> = {
  spec: 'Spec',
  question: 'Question',
  pr: 'PR ready',
  after_deploy: 'After deploy',
  done: 'Done',
}
const OTHER_KIND_LABEL = 'Session'

export type MessageShape = 'system' | 'james' | 'session'

// Where a comment sits: a quiet centred line, James on the right, any other session message.
export function messageShape(comment: Pick<Comment, 'author' | 'kind'>): MessageShape {
  if (comment.author === 'james') return 'james'
  return comment.kind === 'system' ? 'system' : 'session'
}

// "Spec", "Question", "PR ready", "After deploy", "Done"; "Session" for info or anything this
// app does not know (a kind from a newer session must still render).
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? OTHER_KIND_LABEL

// "<Kind> · <relative time>"; the time is left out when the comment has no usable timestamp.
export function sessionLabel(comment: Pick<Comment, 'kind' | 'createdAt'>, now: number): string {
  const kind = kindLabel(comment.kind)
  return isDateable(comment.createdAt) ? `${kind} · ${relativeTime(comment.createdAt, now)}` : kind
}

// James's relative time under his message, '' when the comment has no usable timestamp.
export const sentTime = (comment: Pick<Comment, 'createdAt'>, now: number): string =>
  isDateable(comment.createdAt) ? relativeTime(comment.createdAt, now) : ''

// The one session message that carries Read more: the latest whose kind is the kind of need the
// task has open. Earlier messages of that kind are history.
export function readMoreId(comments: readonly Comment[], need: TaskNeed | null): string | null {
  if (!need) return null
  for (let i = comments.length - 1; i >= 0; i--)
    if (comments[i].author !== 'james' && comments[i].kind === need.kind) return comments[i].id
  return null
}

// The comment's text; a document with a missing or non-string body shows an empty bubble
// instead of taking the thread down.
export const bodyText = (comment: Pick<Comment, 'body'>): string =>
  typeof comment.body === 'string' ? comment.body : ''

// What a reply from the composer is: the answer when the task waits on a question, else a
// plain comment.
export const replyKind = (task: Pick<Task, 'needs'>): CommentKind =>
  task.needs?.kind === 'question' ? 'answer' : 'comment'

// James's comment in the one shape every writer and the screen's optimistic copy use: body
// trimmed and capped, no delivery stamps (the agent's to set), so it reads "sent".
export function jamesComment(
  task: Pick<Task, 'id' | 'projectId' | 'agentId'>,
  kind: CommentKind,
  body: string,
  at: number,
  id: string
): Comment {
  return {
    id,
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body: body.trim().slice(0, MAX_COMMENT_CHARS),
    createdAt: at,
    deliveredAt: null,
    workingAt: null,
    handledAt: null,
  }
}

// The saved comments plus every pending reply the snapshot does not hold yet, oldest first.
// Matching is by id, never by text, so the same text sent twice shows twice. The sort is
// stable, so equal timestamps keep their order.
export function mergeMessages(saved: readonly Comment[], pending: readonly Comment[]): Comment[] {
  const known = new Set(saved.map((c) => c.id))
  const all = [...saved, ...pending.filter((c) => !known.has(c.id))]
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

// The task's stage chain, safe on a half-migrated document (no afterDeploy list, a type this
// app does not know): such a task shows no stepper rather than crashing the thread.
export function stagesOf(task: Pick<Task, 'type' | 'afterDeploy'>): Stage[] {
  if (!TASK_TYPES.includes(task.type)) return []
  const afterDeploy = Array.isArray(task.afterDeploy) ? task.afterDeploy : []
  return taskStages({ type: task.type, afterDeploy })
}

export const NO_MESSAGES_TEXT = 'No messages yet.'

// What a thread with no messages says. A task James queued that no session has picked up yet
// says so (the line is not stored: the rules keep James from writing session or system
// comments); anything else is the plain empty note.
export function emptyThreadText(
  task: Pick<Task, 'type' | 'afterDeploy' | 'stage' | 'agentId' | 'createdBy'>,
  projectName: string | null
): string {
  const waiting =
    task.createdBy === 'james' && task.agentId === null && stagesOf(task)[0] === task.stage
  if (!waiting) return NO_MESSAGES_TEXT
  return `Queued by you · waiting for a session${projectName ? ` in ${projectName}` : ''}`
}
```

### tests/fixtures/app-logs-emulator.ts

```ts
// Shared setup for the app-logs L1 emulator suites (tests/emulator/app-logs-*.test.ts). Run with
// `npm run test:rules` (emulators:exec sets FIRESTORE_EMULATOR_HOST; project demo-kanban). Never
// against a live project.
//
// Web side: the real packages/web/src/lib/log.ts (real logger, real log store) writing to the
// emulator as James under the real firestore.rules. Each suite wires the mocks itself:
//   vi.mock('virtual:app-manifest', async () =>
//     (await import('../fixtures/app-logs-emulator.ts')).manifestModule())
//   vi.mock('../../packages/web/src/firebase.ts', async () =>
//     (await import('../fixtures/app-logs-emulator.ts')).firebaseModule())
// then calls useWebEmulator() at the top level of the file.
//
// Agent side: the stored `logs` read back with the agent's own admin db (emulator mode), and
// the real agent spawned over stdio against the same emulator (startAgent).
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  getDocs,
  waitForPendingWrites,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { Timestamp as AdminTimestamp, type Firestore as AdminDb } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
export const DAY = 24 * 60 * 60 * 1000
export const RETENTION = 30 * DAY // LOG_RETENTION_MS
export const STORED_KEYS = [
  'schema_version',
  'taxonomy_version',
  'timestamp',
  'severity',
  'app_id',
  'client_id',
  'env',
  'source',
  'event_type',
  'audience',
  'session_id',
  'trace_id',
  'user_id',
  'message',
  'context',
  'ts',
  'expireAt',
  'request_id',
].sort()

// ---- web ------------------------------------------------------------------------------------

type User = { uid: string; email: string; emailVerified: boolean }
const JAMES: User = { uid: 'james-uid', email: 'j@nullnoise.ai', emailVerified: true }
const web = {
  env: null as RulesTestEnvironment | null,
  james: null as Firestore | null,
  stranger: null as Firestore | null,
  db: null as Firestore | null,
  user: JAMES as User | null,
}

// The signed-in user as firebase/auth reports it (currentUser and the auth-state callbacks).
const auth = {
  get currentUser() {
    return web.user
  },
  onAuthStateChanged(cb: (u: User | null) => void) {
    cb(web.user)
    return () => {}
  },
  authStateReady: () => Promise.resolve(),
}

export const firebaseModule = () => ({
  app: {},
  auth,
  get db() {
    return web.db
  },
})
export const manifestModule = () => ({
  default: {
    app_id: 'kanban',
    client_id: 'jamesdavisonio',
    audience_default: 'internal',
    log_endpoint: null,
    env: 'prod',
  },
})

export function useWebEmulator() {
  beforeAll(async () => {
    web.env = await initializeTestEnvironment({
      projectId: 'demo-kanban',
      firestore: {
        rules: readFileSync(join(ROOT, 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
    const ctx = (uid: string, email: string) =>
      web.env!.authenticatedContext(uid, { email, email_verified: true }).firestore() as unknown
    web.james = ctx('james-uid', 'j@nullnoise.ai') as Firestore
    web.stranger = ctx('someone', 'someone@example.com') as Firestore
  })
  afterAll(async () => {
    await web.env?.cleanup()
    web.env = null
  })
  beforeEach(async () => {
    await web.env?.clearFirestore()
    web.db = web.james
    web.user = JAMES
  })
}

export const signOut = () => void (web.user = null)
export const signIn = () => void (web.user = JAMES)
// The app's Firestore becomes a browser the rules refuse (signed in, but not as James).
export const useRefusingDb = () => void (web.db = web.stranger)
export const useOwnerDb = () => void (web.db = web.james)
export const appDb = (): Firestore => {
  if (!web.db) throw new Error('useWebEmulator() has not started the emulator')
  return web.db
}

// Every stored log event, once the app's pending writes have reached the emulator.
export async function storedLogs(): Promise<DocumentData[]> {
  if (!web.env) throw new Error('useWebEmulator() has not started the emulator')
  await waitForPendingWrites(appDb())
  return serverSide()
}
// What the emulator holds right now, without waiting for the app.
export async function serverSide(): Promise<DocumentData[]> {
  let out: DocumentData[] = []
  await web.env!.withSecurityRulesDisabled(async (c) => {
    const snap = await getDocs(collection(c.firestore() as unknown as Firestore, 'logs'))
    out = snap.docs.map((d) => d.data())
  })
  return out
}
export const byRequest = (events: DocumentData[], id: string) =>
  events.filter((e) => e.request_id === id)

// ---- agent ----------------------------------------------------------------------------------

// The agent's admin db (emulator mode), imported lazily so web suites never start it.
export async function adminDb(): Promise<AdminDb> {
  return (await import('../../packages/agent/src/firestore.ts')).getDb()
}

export async function clearLogs() {
  const db = await adminDb()
  await db.recursiveDelete(db.collection('logs'))
}

export async function agentLogs(pred: (e: DocumentData) => boolean = () => true) {
  const snap = await (await adminDb()).collection('logs').get()
  return snap.docs.map((d) => d.data()).filter(pred)
}

// Resolves with the first stored event matching `pred`; rejects after `ms`.
export async function waitForLog(
  pred: (e: DocumentData) => boolean,
  what: string,
  ms = 8000
): Promise<DocumentData> {
  const db = await adminDb()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop()
      reject(new Error(`no stored log event: ${what}`))
    }, ms)
    const stop = db.collection('logs').onSnapshot((snap) => {
      const hit = snap.docs.map((d) => d.data()).find(pred)
      if (!hit) return
      clearTimeout(timer)
      stop()
      resolve(hit)
    })
  })
}

// A stored event as the contract shapes it, `minutesAgo` before now.
export function logDoc(e: {
  minutesAgo: number
  severity: string
  source: 'web_client' | 'server'
  request_id?: string | null
  message?: string
  event_type?: string
}) {
  const ts = Date.now() - e.minutesAgo * 60_000
  const request_id = e.request_id ?? null
  return {
    schema_version: 1,
    taxonomy_version: 6,
    timestamp: new Date(ts).toISOString(),
    severity: e.severity,
    app_id: 'kanban',
    client_id: 'jamesdavisonio',
    env: 'prod',
    source: e.source,
    event_type: e.event_type ?? 'api_call_failed',
    audience: 'internal',
    session_id: 's-test',
    trace_id: null,
    user_id: null,
    message: e.message ?? `${e.severity} ${e.minutesAgo}m`,
    context: { target: 'firestore', status: 'unavailable', ...(request_id ? { request_id } : {}) },
    ts,
    expireAt: AdminTimestamp.fromMillis(ts + RETENTION),
    request_id,
  }
}

export async function seedLogs(docs: ReturnType<typeof logDoc>[]) {
  const db = await adminDb()
  const batch = db.batch()
  for (const d of docs) batch.set(db.collection('logs').doc(), d)
  await batch.commit()
}

// What kanban_logs returns for one stored event.
export const asRead = (d: ReturnType<typeof logDoc>) => ({
  time: d.timestamp,
  severity: d.severity,
  event_type: d.event_type,
  source: d.source,
  message: d.message,
  request_id: d.request_id,
  context: d.context,
})

export interface ToolResult {
  isError: boolean
  text: string
}
export interface AgentClient {
  pid: number
  stderr(): string
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>
  json<T>(name: string, args?: Record<string, unknown>): Promise<T>
  tools(): Promise<{ name: string; inputSchema: { properties?: Record<string, unknown> } }[]>
  close(): Promise<void>
}

// The real agent over stdio against the emulator, from its own temporary project folder, the
// way Claude Code starts it. KANBAN_SA points at a file that is not a key, so nothing on this
// machine but the emulator can be reached; APP_ENV is unset (the agent's default applies).
export async function startAgent(name: string): Promise<AgentClient> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('run through npm run test:rules')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_PROJECT_ID: 'demo-kanban',
    KANBAN_SA: fileURLToPath(import.meta.url),
  }
  delete env.KANBAN_TEST_LIVE
  delete env.APP_ENV
  const child = spawn(process.execPath, [join(ROOT, 'packages', 'agent', 'src', 'index.ts')], {
    env,
    cwd: mkdtempSync(join(tmpdir(), `app-logs-${name}-`)),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let err = ''
  child.stderr.on('data', (d: Buffer) => (err += d.toString()))
  type Reply = { id?: number; result?: Record<string, unknown>; error?: unknown }
  const waiting = new Map<number, (m: Reply) => void>()
  let buf = ''
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString()
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const msg = JSON.parse(line) as Reply
      if (msg.id !== undefined) waiting.get(msg.id)?.(msg)
    }
  })
  let next = 1
  const send = (msg: object) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`)
  const request = (method: string, params: object) =>
    new Promise<Reply>((resolve, reject) => {
      const id = next++
      const timer = setTimeout(
        () => reject(new Error(`no reply to ${method}; agent stderr:\n${err.slice(-2000)}`)),
        15_000
      )
      waiting.set(id, (m) => {
        clearTimeout(timer)
        resolve(m)
      })
      send({ id, method, params })
    })

  await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: `app-logs-${name}`, version: '0' },
  })
  send({ method: 'notifications/initialized' })

  const call = async (tool: string, args: Record<string, unknown> = {}) => {
    const m = await request('tools/call', { name: tool, arguments: args })
    if (m.error) throw new Error(`${tool} rpc error: ${JSON.stringify(m.error)}`)
    const r = m.result as { isError?: boolean; content?: { text: string }[] }
    return { isError: r.isError === true, text: r.content?.[0]?.text ?? '' }
  }
  return {
    pid: child.pid!,
    stderr: () => err,
    call,
    async json<T>(tool: string, args: Record<string, unknown> = {}) {
      const r = await call(tool, args)
      if (r.isError) throw new Error(`${tool} tool error: ${r.text}`)
      return JSON.parse(r.text) as T
    },
    async tools() {
      const m = await request('tools/list', {})
      return (m.result as { tools: Awaited<ReturnType<AgentClient['tools']>> }).tools
    },
    close: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve()
        const timer = setTimeout(() => child.kill(), 10_000)
        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
        child.stdin.end()
      }),
  }
}

// One agent per file, started after the logs are cleared and closed after the last test.
export function useAgent(name: string): () => AgentClient {
  let agent: AgentClient | null = null
  beforeAll(async () => {
    agent = await startAgent(name)
  }, 30_000)
  afterAll(() => agent?.close(), 30_000)
  return () => {
    if (!agent) throw new Error('useAgent() has not started the agent')
    return agent
  }
}

export const AGENT_LOG = join(ROOT, 'packages', 'agent', 'agent.log')
```

### tests/fixtures/board-briefs-b7-emulator.ts

```ts
// Shared setup for the board-briefs B7 agent suites (tests/emulator/board-briefs-b7-*.test.ts):
// the desktop agent's real Board against the Firestore emulator, the way a session uses it through
// the kanban_* tools. Run with `npm run test:rules` (project demo-kanban; emulators:exec sets
// FIRESTORE_EMULATOR_HOST, so the Board's admin db is the emulator). Never against a live project.
//
// One Board per file, registered once (its own project from a unique cwd) and shut down after.
// Each test makes its own task with createTask (bound to this session) and moves it to the stage
// under test with the admin db, so no test depends on another's writes.
import { afterAll, beforeAll } from 'vitest'
import type { Comment, Task, TaskType } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

const state = { board: null as Board | null }

export function useBoard(name: string): () => Board {
  beforeAll(async () => {
    const board = new Board(`/tmp/board-briefs-b7-${name}-${Date.now()}`)
    await board.register()
    state.board = board
  })
  afterAll(async () => {
    await state.board?.shutdown()
    state.board = null
  })
  return () => {
    if (!state.board) throw new Error('useBoard() has not registered the board')
    return state.board
  }
}

// A task of `type` made by this session, then set to `fields` (stage, needs, ...) as stored.
export async function taskAt(
  board: Board,
  type: TaskType,
  fields: Partial<Omit<Task, 'id'>>
): Promise<Task> {
  const task = await board.createTask({ title: `B7 ${type} at ${fields.stage ?? 'start'}`, type })
  await board.db.collection('tasks').doc(task.id).update(fields)
  return { ...task, ...fields }
}

export async function readTask(board: Board, id: string): Promise<Omit<Task, 'id'>> {
  const snap = await board.db.collection('tasks').doc(id).get()
  if (!snap.exists) throw new Error(`task ${id} is gone`)
  return snap.data() as Omit<Task, 'id'>
}

// The task's comments, oldest first.
export async function readComments(board: Board, taskId: string): Promise<Comment[]> {
  const snap = await board.db.collection('comments').where('taskId', '==', taskId).get()
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}
```

### tests/emulator/app-logs-10.test.ts

```ts
// app-logs L1, criterion 10: kanban_logs with a request id returns every stored event with that
// id, of any severity and from either source, oldest first, with no time bound: the trail of one
// operation, from the phone and from the agent. The real agent over stdio against the emulator
// (`npm run test:rules`); events are seeded with the admin db.
import { beforeEach, describe, expect, it } from 'vitest'
import { asRead, clearLogs, logDoc, seedLogs, useAgent } from '../fixtures/app-logs-emulator.ts'

const agent = useAgent('10')
const read = (args: Record<string, unknown>) =>
  agent().json<{ events: ReturnType<typeof asRead>[] }>('kanban_logs', args)

beforeEach(() => clearLogs())

describe('L1-10 kanban_logs with a request id', () => {
  it('returns the whole trail of that operation, oldest first', async () => {
    const trail = [
      logDoc({
        minutesAgo: 3 * 24 * 60,
        severity: 'DEBUG',
        source: 'web_client',
        request_id: 'r-10',
      }),
      logDoc({ minutesAgo: 90, severity: 'INFO', source: 'web_client', request_id: 'r-10' }),
      logDoc({ minutesAgo: 89, severity: 'ERROR', source: 'server', request_id: 'r-10' }),
      logDoc({ minutesAgo: 1, severity: 'WARNING', source: 'web_client', request_id: 'r-10' }),
    ]
    const others = [
      logDoc({ minutesAgo: 2, severity: 'ERROR', source: 'server', request_id: 'r-other' }),
      logDoc({ minutesAgo: 5, severity: 'CRITICAL', source: 'web_client', request_id: null }),
    ]
    await seedLogs([...trail, ...others].reverse())
    expect(await read({ request_id: 'r-10' })).toEqual({ events: trail.map(asRead) })
  })

  it('returns nothing for an id nobody logged', async () => {
    await seedLogs([
      logDoc({ minutesAgo: 1, severity: 'ERROR', source: 'server', request_id: 'r-x' }),
    ])
    expect(await read({ request_id: 'r-unknown' })).toEqual({ events: [] })
  })
})
```

### tests/emulator/fix-stale-stage-need.test.ts

```ts
// Repro for the stale stage need (fix/stale-stage-need): when kanban_subtask marks a stage done
// (Board.setSubtask) and the task jumps past its current stage, the need that the skipped stage
// was waiting on must clear, exactly as it does when that stage itself is marked done. Seen live
// on 2026-11-05: a task at pr waiting on the merge (needs { kind: 'pr' }) was marked "merged"
// done, moved to main_ci, and still showed as waiting on James's merge.
// Runs the real Board against the Firestore emulator (`npm run test:rules`).
import { describe, expect, it } from 'vitest'
import type { Task, TaskType } from '../../packages/shared/src/index.ts'
import { readTask, taskAt, useBoard } from '../fixtures/board-briefs-b7-emulator.ts'

const board = useBoard('stale-need')

describe('marking a later stage done clears the need of the stage it skips', () => {
  it.each([
    [
      'a feature at pr waiting on the merge, "merged" done',
      'feature',
      'pr',
      'pr',
      'merged',
      'main_ci',
    ],
    [
      'a bugfix at pr waiting on the merge, "merged" done',
      'bugfix',
      'pr',
      'pr',
      'merged',
      'main_ci',
    ],
    [
      'a feature at spec waiting on approval, "approved" done',
      'feature',
      'spec',
      'spec',
      'approved',
      'build',
    ],
  ] as [string, TaskType, Task['stage'], 'pr' | 'spec', string, Task['stage']][])(
    '%s: moves on and waits on nothing',
    async (_name, type, stage, need, key, next) => {
      const task = await taskAt(board(), type, { stage, needs: { kind: need } })
      await board().setSubtask(task.id, key, 'done')
      const stored = await readTask(board(), task.id)
      expect(stored.stage).toBe(next)
      expect(stored.needs).toBeNull()
    }
  )

  it('marking the waiting stage itself done still clears its need (unchanged)', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'pr', needs: { kind: 'pr' } })
    await board().setSubtask(task.id, 'pr', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('merged')
    expect(stored.needs).toBeNull()
  })

  it('an open question is not a stage need: it stays when stages are skipped', async () => {
    const needs = { kind: 'question' as const, question: 'Which branch should this go to?' }
    const task = await taskAt(board(), 'feature', { stage: 'pr', needs })
    await board().setSubtask(task.id, 'merged', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('main_ci')
    expect(stored.needs).toEqual(needs)
  })

  it('a stage the task has already passed changes nothing', async () => {
    const task = await taskAt(board(), 'feature', { stage: 'main_ci', needs: null })
    await board().setSubtask(task.id, 'pr', 'done')
    const stored = await readTask(board(), task.id)
    expect(stored.stage).toBe('main_ci')
    expect(stored.needs).toBeNull()
  })
})
```

### tests/emulator/agent-heartbeat.test.ts

```ts
// Reproduction for the Firestore quota drain (2026-11-04): every running agent wrote its
// heartbeat every 30 s, so twelve agents left open (two per session, from the double spawn)
// made about 34,500 writes a day against the free plan's 20,000. Runs a real agent
// registration against the emulator with a fake clock and counts its heartbeat writes.
//
// Budget: an always-on agent may write at most 12 heartbeats an hour (one every five
// minutes), so twelve always-on agents stay under a fifth of the daily free write quota.
// And the fix must not trade presence for quota: an agent that is heartbeating is reported
// online at every moment, so the board's live dot never flickers off between beats.
import { DocumentReference } from 'firebase-admin/firestore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAgentOnline } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

const MINUTE = 60 * 1000
const MAX_BEATS_PER_HOUR = 12

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('agent heartbeat', () => {
  it('writes at most 12 heartbeats an hour and is online at every minute of it', async () => {
    // The interval and the clock are fake from before registration, so the agent's own
    // heartbeat timer is the one being advanced; network I/O keeps its real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() })
    const board = new Board(`/tmp/heartbeat-${Date.now()}`)
    await board.register()
    const agentPath = `agents/${board.id.agentId}`

    // Count only this agent's heartbeat updates.
    const beats: number[] = []
    let lastSeen = Date.now()
    vi.spyOn(DocumentReference.prototype, 'update').mockImplementation(function (
      this: DocumentReference,
      data: unknown
    ) {
      if (this.path === agentPath) {
        const seen = (data as { lastSeen?: number }).lastSeen
        if (typeof seen === 'number') {
          beats.push(seen)
          lastSeen = seen
        }
      }
      return Promise.resolve({} as never)
    })

    try {
      for (let minute = 1; minute <= 60; minute++) {
        vi.advanceTimersByTime(MINUTE)
        expect(isAgentOnline({ lastSeen }, Date.now())).toBe(true)
      }
      expect(beats.length).toBeGreaterThan(0)
      expect(beats.length).toBeLessThanOrEqual(MAX_BEATS_PER_HOUR)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
      await board.shutdown()
    }
  }, 30_000)
})
```

### logging/taxonomy.json

```json
{
  "taxonomy_version": 6,
  "governance": "Single source of truth for event_type values. Agents READ this file; only humans WRITE it. New types are born only through rule R3 in instrument/SKILL.md (log unclassified + context.proposed_type, human commits the entry here).",
  "event_types": {
    "feature_error": {
      "severity_hint": "ERROR",
      "desc": "Unhandled error inside a feature",
      "required_context": ["feature"]
    },
    "api_call_failed": {
      "severity_hint": "ERROR",
      "desc": "External call (API/DB/3rd party) failed",
      "required_context": ["target", "status"]
    },
    "validation_failed": {
      "severity_hint": "WARNING",
      "desc": "User or data input rejected",
      "required_context": ["field"]
    },
    "session_start": {
      "severity_hint": "INFO",
      "desc": "User/learner session begins",
      "required_context": []
    },
    "session_end": {
      "severity_hint": "INFO",
      "desc": "Session ends (incl. abrupt close)",
      "required_context": ["duration_s"]
    },
    "user_action": {
      "severity_hint": "INFO",
      "desc": "Meaningful user interaction",
      "required_context": ["action"]
    },
    "milestone_reached": {
      "severity_hint": "INFO",
      "desc": "Business milestone (module completed, quiz passed…)",
      "required_context": ["milestone"]
    },
    "cache_miss": {
      "severity_hint": "INFO",
      "desc": "Requested item not found in cache, fetched from source",
      "required_context": ["target"]
    },
    "duplicate_suppressed": {
      "severity_hint": "INFO",
      "desc": "Idempotency guard dropped a repeat delivery of an already-processed event",
      "required_context": ["tracker_id", "event_id", "source"]
    },
    "write_conflict": {
      "severity_hint": "WARNING",
      "desc": "Optimistic-concurrency write rejected: the caller's revision no longer matches the stored one",
      "required_context": [
        "feature",
        "entity_type",
        "entity_id",
        "expected_revision",
        "actual_revision"
      ]
    },
    "access_denied": {
      "severity_hint": "WARNING",
      "desc": "Request refused by identity or authorisation checks (unauthenticated, pending, archived, role, client_scope)",
      "required_context": ["feature", "actor_role", "route", "reason"]
    },
    "unclassified": {
      "severity_hint": "INFO",
      "desc": "Fallback ONLY — see rule R3 in instrument/SKILL.md",
      "required_context": ["proposed_type"]
    }
  }
}
```

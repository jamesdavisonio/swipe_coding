# Fidelity check — board-replies-anywhere R1

Role: `verify`, fresh context. You have not seen the test author or any plan discussion.

## Your prompt (verbatim)

# Test-fidelity checker prompt

For `codex-only`, use [the Codex fidelity prompt](../../../harness/codex/fidelity-prompt.md)
instead of this portable prompt, including its correction limits. The coordinator
supplies that prompt and the assigned test-stage rules directly to the checker.

For step 2b of `implement-feature`. This is the gate that replaced the human
"tests reviewed" checkpoint (ADR 0005). The checker must be an isolated
context — Claude Code: fresh subagent (or the connector's `verify` role
under `personal`); Codex: fresh `codex exec` sibling; single-model CLIs:
fresh chat — and under
a multi-family profile its model family must differ from the test author's
(`constraints.test_author_rule` in `model-roles.yaml`; under a
single-family profile a distinct fresh context, preferably a different
in-family model, is the rule — ADR 0008).

The checker judges tests against the spec and grounded public contract. It
may see baseline public interfaces, schema and harness examples, but never
the proposed feature implementation or build transcript. It never edits tests.

## Contents

- [Prompt to paste](#prompt-to-paste)
- [Delta prompt](#delta-prompt)
- [The revision loop](#the-revision-loop)
- [Rules for the checker](#rules-for-the-checker)

## Prompt to paste

```
You are auditing acceptance tests against a feature spec. You did not write
these tests, and the proposed implementation is withheld. Your question: do these
tests faithfully encode the spec, and would they catch a lazy or gaming
implementation?

Inputs I am giving you:
1. The feature spec at docs/features/<slug>.md
2. The test file(s) drafted for it
3. instrument/taxonomy.json (for the log-assertion checks)
4. The author's grounded contract/baseline/harness packet and assigned criteria

Walk every check. Do not stop at the first failure — report all of them.

Grounding:
- Missing relevant baseline or contract evidence is a hygiene gap, not permission
  to invent it. Check identifiers, schema keys, auth headers and harness exports.
- Distinguish observed facts from selected new contract details. Exact routes,
  payloads and statuses must be grounded in one of those, within confirmed scope.
- Baseline behaviour and proposed changes must remain distinguishable. A test
  failing because its baseline fixture cannot run is invalid red evidence.

Spec coverage:
- Map each acceptance criterion to the specific test(s) that encode it.
  For a partial draft, map the assigned subset and shared requirements; before
  the red checkpoint, the combined gate must map the whole feature spec.
- Are the named edge cases for assigned criteria and applicable shared
  requirements each covered? The combined gate checks all spec edge cases.
- Does any test assert behaviour the spec does not ask for? Out-of-scope
  tests smuggle scope in; report them.

Would a bad implementation pass?
- Tautologies: does any test pass trivially (asserting a constant, asserting
  the mock, expect(true))?
- Stub test: imagine the laziest implementation that could pass each test
  (return hardcoded value, empty function, echo the input). If one exists,
  the test is too weak; report it with the stub that beats it.
- Are assertions specific (exact values, shapes, error codes) rather than
  loose (toBeDefined, toBeGreaterThanOrEqual(0), not.toThrow alone)? Exactness
  must follow the supplied contract; unsupported exact values are gaps too.

Test hygiene:
- Behavioural, not structural: tests assert what a caller observes, not
  internal functions/private state.
- Minimal mocks: only external I/O mocked. A test that mocks the thing under
  test proves nothing; report it.
- Error paths assert observable logging with the spec's taxonomy event_type,
  severity and required context using the isolated capture convention. Do not
  require ERROR/log.error for WARNING events or mock the logger under test.
  Verify each event_type exists in the supplied taxonomy.
- No .only / .skip / xfail / sleeps / retries anywhere.
- Test file names match the spec slug.

Output: a short human-readable summary first, then EXACTLY ONE fenced JSON
object, last thing in the message:

{
  "verdict": "PASS" | "FAIL",
  "criteria_map": [
    { "criterion": "<verbatim from spec>", "tests": ["<file>::<test name>"] }
  ],
  "gaps": [
    { "type": "uncovered-criterion" | "missing-edge-case" | "weak-assertion" | "out-of-scope-test" | "hygiene",
      "where": "<file>::<test name> | <criterion>",
      "issue": "<one sentence>",
      "fix": "<one sentence>" }
  ],
  "gaming_flags": [
    { "where": "<file>::<test name>",
      "stub_that_passes": "<the lazy implementation that would pass this test>" }
  ]
}

Verdict rule: PASS requires every assigned acceptance criterion mapped to at least
one non-tautological test, zero gaming_flags, and no hygiene violations.
Anything else is FAIL. There is no "PASS with reservations" — reservations
are gaps, and gaps mean FAIL.
```

## Delta prompt

For every re-check after the first FAIL. A fresh context each round, same
binding rules as the full audit.

```
You are re-checking a repair to acceptance tests. A previous audit listed
specific problems; the test author has repaired them. You did not write
these tests, and the implementation is withheld.

Inputs I am giving you:
1. The feature spec, including any contract decisions added since the audit
2. The repaired test file(s)
3. The open list: the gaps and gaming flags from the previous round, verbatim
4. The repair diff: exactly what changed in the tests since that round
5. instrument/taxonomy.json and the grounded contract/baseline/harness packet

Check only two things:
- For each item on the open list: is it now closed? For a gaming flag, try
  the listed stub again and any equally cheap variant against the repaired
  test.
- For each line the repair diff touched: did it break a criterion mapping,
  weaken an assertion, add a hygiene violation, or open a new stub? Report
  those as new gaps.

Do not audit tests or lines the repair did not touch. Do not raise new
nits outside the diff; this is not a fresh audit. If you notice a real
problem outside the diff anyway, mention it in the summary as a note for
the code reviewer. It never goes in gaps[] and never costs another round.

Output: the same summary and JSON verdict as the full audit. gaps[] and
gaming_flags[] hold only items still open plus regressions from the repair.
criteria_map[] covers the criteria the repaired tests encode.
PASS only when both lists are empty.
```

## The revision loop

- On FAIL, the calling skill feeds `gaps[]` and `gaming_flags[]` back to the
  **test author** (same isolated setup, same role) as the revision brief.
  The author repairs exactly those items and nothing else. The checker
  never fixes tests itself.
- A gap that needs a planner decision inside confirmed scope is recorded in
  the spec's "Selected new contract" block before the repair. A gap that
  needs a behaviour or acceptance-criterion change escalates instead.
- The full audit runs once per gate scope; each re-check is the delta
  prompt above. Up to four delta rounds run automatically.
- Escalate to the human, with a round decision brief, the spec, the tests,
  the last verdict and the open list per round, when a round does not
  shrink the open list, a gap needs a spec change, a closed gaming flag
  reappears, or the fourth delta round ends without PASS. Say which item
  keeps failing; non-convergence is almost always a spec problem. The
  human's reply to continue is "another round" (one more delta round).
- Validate the JSON against the shape above before acting on it. On invalid
  JSON: one re-ask quoting the parse error, then fall through to the next
  eligible verify model (family ≠ test author), per `output_contracts` in
  `model-roles.yaml`.

## Rules for the checker

- **No paraphrase of the spec.** Read it, map it criterion by criterion.
- **No trust in test names.** A test named "validates input" that asserts
  `toBeDefined` is a weak assertion; the name is not evidence.
- **The stub test is the core move.** For every test, actively try to write
  the cheapest implementation that passes it. This is what the human used to
  do by eye; do it exhaustively.
- **A single gaming flag fails the gate.** Hard signal, not soft.

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
  (`james` | `agent`, the session), `kind` (`comment` | `answer`), `body`, `createdAt`, `deliveredAt`
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
    comment (author `agent`, kind `info`, `deliveredAt` set like every session comment) with
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

## Grounding packet

The test author received the packet at `C:/Users/Intel/AppData/Local/Temp/claude/e5b50efda45c3b6c/15399a86-1ff4-4831-8392-e476864b21fd/scratchpad/packet-test-author-r1.md` (rules, repository notes, and the observed sources). Read its "Repository notes" and any quoted source you need; it is the same contract/baseline/harness context.

## Test files (verbatim)

### tests/fixtures/board-replies-anywhere-emulator.ts

```ts
// Shared setup for the board-replies-anywhere R1 suites (tests/emulator/board-replies-anywhere-r1-*):
// the watcher (packages/agent/src/wait.ts) and the real agent, each spawned over stdio against the
// Firestore emulator, with the board seeded and read back through the agent's own admin db. Run
// with `npm run test:rules` (emulators:exec sets FIRESTORE_EMULATOR_HOST; project demo-kanban).
// Never against a live project: every child gets KANBAN_SA pointed at this file (it exists but is
// not a key), so the key lookup stops there, and KANBAN_TEST_LIVE is removed.
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, afterEach, beforeAll } from 'vitest'
import {
  initialTaskFields,
  type AgentDoc,
  type Comment,
  type JamesCommentKind,
  type Task,
  type TaskNeed,
} from '../../packages/shared/src/index.ts'

const ROOT = join(import.meta.dirname, '..', '..')
export const WAIT_TS = join(ROOT, 'packages', 'agent', 'src', 'wait.ts')
const AGENT_TS = join(ROOT, 'packages', 'agent', 'src', 'index.ts')
export const QUESTION: TaskNeed = { kind: 'question', question: 'Which branch should this go to?' }

// The emulator env startAgent builds; `offline` drops the emulator too, so the board is offline.
function childEnv(offline = false): NodeJS.ProcessEnv {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('run through npm run test:rules')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_PROJECT_ID: 'demo-kanban',
    KANBAN_SA: fileURLToPath(import.meta.url),
  }
  delete env.KANBAN_TEST_LIVE
  delete env.APP_ENV
  if (offline) delete env.FIRESTORE_EMULATOR_HOST
  return env
}

const live = new Set<ChildProcess>()
const tmp = (what: string) => mkdtempSync(join(tmpdir(), `replies-r1-${what}-`))

// The agent's admin db (emulator mode) for the file; leftover children are killed after each test.
export function useBoardDb(): () => Firestore {
  let db: Firestore | null = null
  beforeAll(async () => {
    db = (await import('../../packages/agent/src/firestore.ts')).getDb()
  })
  afterEach(() => {
    for (const child of live) child.kill()
    live.clear()
  })
  return () => {
    if (!db) throw new Error('useBoardDb() has not opened the emulator')
    return db
  }
}

// ---- seeding the board ----------------------------------------------------------------------

export interface Session {
  agentId: string
  projectId: string
}
let clock = 0
const tick = () => (clock = Math.max(Date.now(), clock + 1))

// A session as the board knows it: an agents document (live unless `lastSeen` says otherwise).
export async function seedSession(db: Firestore, fields: Partial<AgentDoc> = {}): Promise<Session> {
  const ref = db.collection('agents').doc()
  const t = Date.now()
  const agent: Omit<AgentDoc, 'id'> = {
    projectId: `replies-r1-${ref.id.toLowerCase()}`,
    hostname: 'replies-r1-host',
    cwd: `/tmp/replies-r1-${ref.id}`,
    pid: 1,
    claudeSessionId: null,
    startedAt: t,
    lastSeen: t,
    ...fields,
  }
  await ref.set(agent)
  return { agentId: ref.id, projectId: agent.projectId }
}

// A feature task bound to `s` (or unbound when its agentId is null), then set to `fields`.
export async function seedTask(
  db: Firestore,
  s: { agentId: string | null; projectId: string },
  fields: Partial<Omit<Task, 'id'>> = {}
): Promise<Task> {
  const ref = db.collection('tasks').doc()
  const task: Omit<Task, 'id'> = {
    ...initialTaskFields({
      projectId: s.projectId,
      type: 'feature',
      title: `R1 ${ref.id}`,
      description: '',
      createdBy: 'agent',
      afterDeploy: [],
      now: Date.now(),
    }),
    agentId: s.agentId,
    working: s.agentId !== null,
    ...fields,
  }
  await ref.set(task)
  return { ...task, id: ref.id }
}

// James's reply as the phone writes it (lib/messages.ts jamesComment): routed to the task's
// session, unmarked. createdAt grows strictly from one call to the next.
export async function postReply(
  db: Firestore,
  task: Pick<Task, 'id' | 'projectId' | 'agentId'>,
  kind: JamesCommentKind,
  body: string,
  createdAt = tick()
): Promise<string> {
  const ref = db.collection('comments').doc()
  const c: Omit<Comment, 'id'> = {
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body,
    createdAt,
    deliveredAt: null,
    workingAt: null,
    handledAt: null,
  }
  await ref.set(c)
  return ref.id
}

// The one stdout line the watcher prints for a reply.
export const replyLine = (task: string, kind: string, id: string, text: string) =>
  JSON.stringify({ task, kind, id, from: 'james', text })

export async function readComment(db: Firestore, id: string): Promise<Omit<Comment, 'id'>> {
  return (await db.collection('comments').doc(id).get()).data() as Omit<Comment, 'id'>
}
export async function readTask(db: Firestore, id: string): Promise<Omit<Task, 'id'>> {
  return (await db.collection('tasks').doc(id).get()).data() as Omit<Task, 'id'>
}
export async function readComments(db: Firestore, taskId: string): Promise<Comment[]> {
  const snap = await db.collection('comments').where('taskId', '==', taskId).get()
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// ---- the watcher ----------------------------------------------------------------------------

export interface WatcherExit {
  code: number | null
  lines: string[] // stdout, one entry per line
  stderr: string
}
export interface Watcher {
  pid: number
  exited: Promise<WatcherExit>
  stderr(): string
}

// `node wait.ts ...args` from a temporary folder, or `command` as given through a shell.
export function startWatcher(
  args: string[],
  opts: { offline?: boolean; command?: string } = {}
): Watcher {
  const env = childEnv(opts.offline)
  const cwd = tmp('watcher')
  const child = opts.command
    ? spawn(opts.command, { shell: true, cwd, env })
    : spawn(process.execPath, [WAIT_TS, ...args], { cwd, env })
  live.add(child)
  let out = ''
  let err = ''
  child.stdout.on('data', (d: Buffer) => (out += d.toString()))
  child.stderr.on('data', (d: Buffer) => (err += d.toString()))
  const exited = new Promise<WatcherExit>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      live.delete(child)
      const lines = out === '' ? [] : out.replace(/\r?\n$/, '').split(/\r?\n/)
      resolve({ code, lines, stderr: err })
    })
  })
  return { pid: child.pid!, exited, stderr: () => err }
}

// The watcher's exit; fails the test if it is still running after `ms`.
export async function finished(
  w: Pick<Watcher, 'exited'> & Partial<Pick<Watcher, 'stderr'>>,
  ms = 15_000
): Promise<WatcherExit> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`watcher still running after ${ms} ms:\n${w.stderr?.().slice(-1500)}`)),
      ms
    )
  })
  try {
    return await Promise.race([w.exited, late])
  } finally {
    clearTimeout(timer)
  }
}

// One whole watcher run for a fresh session with one reply already waiting. Tests await it to
// bound "nothing happened" without sleeping: a watcher started before it has had time to connect
// and wait, and the board and agent have had time to act on anything written before it.
export async function oneWatcherRun(db: Firestore): Promise<void> {
  const s = await seedSession(db)
  const id = await postReply(db, await seedTask(db, s), 'comment', 'marker')
  const run = await finished(startWatcher(['--agent', s.agentId]))
  if (run.code !== 0 || !run.lines.some((l) => l.includes(id)))
    throw new Error(
      `a watcher for a session with one reply waiting did not print it and exit 0 (exit ${run.code}):\n${run.stderr.slice(-1500)}`
    )
}

// ---- the real agent (a session) -------------------------------------------------------------

export interface Notice {
  method: string
  params?: { content?: string; meta?: Record<string, string> }
}
export interface ToolResult {
  isError: boolean
  text: string
}
export interface ToolInfo {
  name: string
  description?: string
  inputSchema: { properties?: Record<string, unknown>; required?: string[] }
}
export interface SessionClient extends Session {
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>
  json<T>(name: string, args?: Record<string, unknown>): Promise<T>
  tools(): Promise<ToolInfo[]>
  notices(): Notice[] // every notification the agent has sent so far
  notice(pred: (n: Notice) => boolean, what: string, ms?: number): Promise<Notice>
  close(): Promise<void>
}

// The real agent over stdio, from its own temporary project folder, registered on the board. Unlike
// app-logs-emulator's startAgent, notifications (messages without an id) are kept.
export async function startSession(name: string): Promise<SessionClient> {
  const child = spawn(process.execPath, [AGENT_TS], {
    env: childEnv(),
    cwd: tmp(`session-${name}`),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let err = ''
  child.stderr.on('data', (d: Buffer) => (err += d.toString()))
  type Reply = { id?: number; result?: Record<string, unknown>; error?: unknown } & Notice
  const waiting = new Map<number, (m: Reply) => void>()
  const notices: Notice[] = []
  const watchers = new Set<(n: Notice) => void>()
  let buf = ''
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString()
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const msg = JSON.parse(line) as Reply
      if (msg.id !== undefined) waiting.get(msg.id)?.(msg)
      else if (msg.method) {
        notices.push(msg)
        for (const w of watchers) w(msg)
      }
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
    clientInfo: { name: `replies-r1-${name}`, version: '0' },
  })
  send({ method: 'notifications/initialized' })

  const call = async (tool: string, args: Record<string, unknown> = {}) => {
    const m = await request('tools/call', { name: tool, arguments: args })
    if (m.error) throw new Error(`${tool} rpc error: ${JSON.stringify(m.error)}`)
    const r = m.result as { isError?: boolean; content?: { text: string }[] }
    return { isError: r.isError === true, text: r.content?.[0]?.text ?? '' }
  }
  const json = async <T>(tool: string, args: Record<string, unknown> = {}) => {
    const r = await call(tool, args)
    if (r.isError) throw new Error(`${tool} tool error: ${r.text}`)
    return JSON.parse(r.text) as T
  }
  const me = await json<Partial<Session>>('kanban_whoami')
  if (!me.agentId || !me.projectId) throw new Error(`agent not on the board:\n${err.slice(-2000)}`)
  return {
    agentId: me.agentId,
    projectId: me.projectId,
    call,
    json,
    async tools() {
      return ((await request('tools/list', {})).result as { tools: ToolInfo[] }).tools
    },
    notices: () => [...notices],
    notice: (pred, what, ms = 10_000) =>
      new Promise<Notice>((resolve, reject) => {
        const hit = notices.find(pred)
        if (hit) return resolve(hit)
        const timer = setTimeout(() => {
          watchers.delete(check)
          reject(new Error(`no notification: ${what}`))
        }, ms)
        const check = (n: Notice) => {
          if (!pred(n)) return
          clearTimeout(timer)
          watchers.delete(check)
          resolve(n)
        }
        watchers.add(check)
      }),
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

// One session per file, started before the first test and closed after the last (sessions are
// not in the after-each cleanup, so one lives across tests).
export function useSession(name: string): () => SessionClient {
  let session: SessionClient | null = null
  beforeAll(async () => {
    session = await startSession(name)
  }, 30_000)
  afterAll(() => session?.close(), 30_000)
  return () => {
    if (!session) throw new Error('useSession() has not started the agent')
    return session
  }
}
```

### tests/emulator\board-replies-anywhere-r1-1.test.ts

```ts
// board-replies-anywhere R1, criterion 1: the results of kanban_create_task and kanban_start_task
// keep their fields and add `watcher`, the exact command that starts this session's watcher
// (`node "<absolute wait.ts, forward slashes>" --agent <agentId>`), runnable from any folder.
// The real agent over stdio; the command itself run through a shell from a temporary folder.
import { isAbsolute, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WAIT_TS,
  finished,
  postReply,
  replyLine,
  seedTask,
  startWatcher,
  useBoardDb,
  useSession,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const session = useSession('r1-1')

// The command names this session's agent and wait.ts by an absolute, forward-slash path.
function expectWatcherCommand(cmd: unknown, agentId: string) {
  const m = /^node "([^"]+)" --agent (\S+)$/.exec(String(cmd))
  expect(m, `watcher command ${JSON.stringify(cmd)}`).not.toBeNull()
  const [, script, agent] = m!
  expect(script).not.toContain('\\')
  expect(isAbsolute(script)).toBe(true)
  expect(resolve(script).toLowerCase()).toBe(resolve(WAIT_TS).toLowerCase())
  expect(agent).toBe(agentId)
}

describe('R1-1 task results carry the watcher command', () => {
  it('kanban_create_task: the task as before plus this session’s watcher', async () => {
    const s = session()
    const r = await s.json<Record<string, unknown>>('kanban_create_task', {
      title: 'R1-1 create',
      type: 'feature',
    })
    expect(r).toMatchObject({ type: 'feature', title: 'R1-1 create', stage: 'spec', mine: true })
    expect(r.needs).toBeNull()
    expect(typeof r.id).toBe('string')
    expectWatcherCommand(r.watcher, s.agentId)
  })

  it('kanban_start_task: the task as before plus this session’s watcher', async () => {
    const s = session()
    const queued = await seedTask(
      db(),
      { agentId: null, projectId: s.projectId },
      {
        createdBy: 'james',
      }
    )
    const r = await s.json<Record<string, unknown>>('kanban_start_task', { task_id: queued.id })
    expect(r).toMatchObject({ id: queued.id, type: 'feature', stage: 'spec', mine: true })
    expect(r.needs).toBeNull()
    expectWatcherCommand(r.watcher, s.agentId)
  })

  it('the command runs as given from another folder and prints the session’s reply', async () => {
    const s = session()
    const r = await s.json<{ id: string; watcher: string }>('kanban_create_task', {
      title: 'R1-1 run',
      type: 'chore',
    })
    const task = { id: r.id, projectId: s.projectId, agentId: s.agentId }
    const id = await postReply(db(), task, 'comment', 'carry on')
    const run = await finished(startWatcher([], { command: r.watcher }))
    expect(run.lines).toEqual([replyLine(r.id, 'comment', id, 'carry on')])
    expect(run.code).toBe(0)
  }, 30_000)
})
```

### tests/emulator\board-replies-anywhere-r1-2.test.ts

```ts
// board-replies-anywhere R1, criterion 2: a running watcher prints James's comment or answer on a
// task bound to its session within a few seconds, as one compact JSON line (task, kind, id, from,
// text verbatim) and nothing else on stdout, then exits 0. It prints only its own session's
// unmarked replies, and never registers as an agent. The watcher spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  QUESTION,
  finished,
  oneWatcherRun,
  postReply,
  readComment,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const TEXT = 'Go with "plan B" — café hours:\n  09:00–17:00\n\\o/ {"not":"json"}'

describe('R1-2 a waiting watcher prints a reply and exits', () => {
  it('a comment: one exact line within a few seconds, exit 0, nobody else’s', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s)
    const other = await seedTask(db(), await seedSession(db()))
    const elsewhere = await postReply(db(), other, 'comment', 'for another session')
    const seen = await postReply(db(), task, 'comment', 'already received')
    await db().collection('comments').doc(seen).update({ deliveredAt: 1 })
    // Not James's: a session comment is never a reply, even unmarked.
    await db().collection('comments').add({
      taskId: task.id,
      projectId: task.projectId,
      agentId: s.agentId,
      author: 'agent',
      kind: 'info',
      body: 'session note',
      createdAt: Date.now(),
      deliveredAt: null,
    })
    const agentBefore = (await db().collection('agents').doc(s.agentId).get()).data()

    const w = startWatcher(['--agent', s.agentId])
    await oneWatcherRun(db())
    const sentAt = Date.now()
    const id = await postReply(db(), task, 'comment', TEXT)
    const run = await finished(w, 10_000)

    expect(Date.now() - sentAt).toBeLessThan(5_000)
    expect(run.lines).toEqual([replyLine(task.id, 'comment', id, TEXT)])
    expect(run.code).toBe(0)
    expect((await readComment(db(), elsewhere)).deliveredAt).toBeNull()
    expect((await db().collection('agents').doc(s.agentId).get()).data()).toEqual(agentBefore)
    expect((await db().collection('agents').where('pid', '==', w.pid).get()).empty).toBe(true)
  }, 40_000)

  it('an answer to the open question: printed with kind "answer"', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s, { needs: QUESTION })
    const w = startWatcher(['--agent', s.agentId])
    await oneWatcherRun(db())
    const id = await postReply(db(), task, 'answer', 'main')
    const run = await finished(w, 10_000)
    expect(run.lines).toEqual([replyLine(task.id, 'answer', id, 'main')])
    expect(run.code).toBe(0)
  }, 40_000)
})
```

### tests/emulator\board-replies-anywhere-r1-3.test.ts

```ts
// board-replies-anywhere R1, criterion 3: replies already waiting when the watcher starts, or
// several arriving close together (within WATCHER_SETTLE_MS = 1000 of the first), are all printed
// by one run, oldest first by createdAt, each exactly once, then the watcher exits. The watcher
// spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  finished,
  oneWatcherRun,
  postReply,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-3 every waiting reply, oldest first, once', () => {
  it('the settle time is the shared WATCHER_SETTLE_MS, 1000 ms', async () => {
    const shared = (await import('../../packages/shared/src/index.ts')) as Record<string, unknown>
    expect(shared.WATCHER_SETTLE_MS).toBe(1000)
  })

  it('replies waiting at start, across tasks: all in createdAt order; the next run has none of them', async () => {
    const s = await seedSession(db())
    const a = await seedTask(db(), s)
    const b = await seedTask(db(), s)
    const t = Date.now() - 60_000
    // Written out of order: the order printed is createdAt's, not the writes'.
    const third = await postReply(db(), a, 'comment', 'third', t + 3)
    const first = await postReply(db(), b, 'comment', 'first', t + 1)
    const second = await postReply(db(), a, 'comment', 'second', t + 2)

    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines).toEqual([
      replyLine(b.id, 'comment', first, 'first'),
      replyLine(a.id, 'comment', second, 'second'),
      replyLine(a.id, 'comment', third, 'third'),
    ])
    expect(run.code).toBe(0)

    const again = startWatcher(['--agent', s.agentId])
    const later = await postReply(db(), b, 'comment', 'later')
    const next = await finished(again)
    expect(next.lines).toEqual([replyLine(b.id, 'comment', later, 'later')])
    expect(next.code).toBe(0)
  }, 40_000)

  it('a burst arriving while it waits comes out together, in order', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s)
    const w = startWatcher(['--agent', s.agentId])
    await oneWatcherRun(db())
    const ids = [
      await postReply(db(), task, 'comment', 'one'),
      await postReply(db(), task, 'comment', 'two'),
      await postReply(db(), task, 'comment', 'three'),
    ]
    const run = await finished(w, 10_000)
    expect(run.lines).toEqual(
      ['one', 'two', 'three'].map((text, i) => replyLine(task.id, 'comment', ids[i], text))
    )
    expect(run.code).toBe(0)
  }, 40_000)
})
```

### tests/emulator\board-replies-anywhere-r1-4.test.ts

```ts
// board-replies-anywhere R1, criterion 4: a reply the watcher printed is marked received (the
// phone's "received" tick, deliveryState 'delivered') and, when it answers the open question, the
// question stops asking for James, by today's rule (kind answer, or any reply while the need is a
// question; updatedAt set either way). A reply no watcher printed stays unmarked. The watcher
// spawned against the emulator; the board read back with the admin db.
import { describe, expect, it } from 'vitest'
import { deliveryState } from '../../packages/shared/src/index.ts'
import {
  QUESTION,
  finished,
  postReply,
  readComment,
  readTask,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-4 printed means received', () => {
  it('marks what it printed and clears the question it answers, as today', async () => {
    const s = await seedSession(db())
    const asked = await seedTask(db(), s, { needs: QUESTION, updatedAt: 1 })
    const askedToo = await seedTask(db(), s, { needs: QUESTION, updatedAt: 1 })
    const spec = await seedTask(db(), s, { needs: { kind: 'spec' }, updatedAt: 1 })
    const ids = [
      await postReply(db(), asked, 'answer', 'main'),
      await postReply(db(), askedToo, 'comment', 'use main'),
      await postReply(db(), spec, 'comment', 'reading it now'),
    ]
    const before = Date.now()
    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines).toHaveLength(3)
    expect(run.code).toBe(0)

    for (const id of ids) {
      const c = await readComment(db(), id)
      expect(deliveryState(c)).toBe('delivered')
      expect(c.deliveredAt).toBeGreaterThanOrEqual(before)
    }
    for (const t of [asked, askedToo, spec]) {
      const stored = await readTask(db(), t.id)
      expect(stored.updatedAt).toBeGreaterThanOrEqual(before)
      expect(stored.needs).toEqual(t === spec ? { kind: 'spec' } : null)
    }
  }, 30_000)

  it('another session’s reply it did not print stays unmarked, its question still open', async () => {
    const s = await seedSession(db())
    const mine = await postReply(db(), await seedTask(db(), s), 'comment', 'mine')
    const theirs = await seedTask(db(), await seedSession(db()), { needs: QUESTION })
    const notMine = await postReply(db(), theirs, 'answer', 'not yours')

    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines.map((l) => (JSON.parse(l) as { id: string }).id)).toEqual([mine])
    expect(run.code).toBe(0)
    expect(deliveryState(await readComment(db(), notMine))).toBe('sent')
    expect((await readTask(db(), theirs.id)).needs).toEqual(QUESTION)
  }, 30_000)
})
```

### tests/emulator\board-replies-anywhere-r1-5.test.ts

```ts
// board-replies-anywhere R1, criterion 5: with no watcher running, James's reply waits on the
// board, unmarked and with its question still open, and the next watcher the session starts
// prints it. The watcher spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  QUESTION,
  finished,
  oneWatcherRun,
  postReply,
  readComment,
  readTask,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-5 a reply with no watcher waits for the next one', () => {
  it('between watchers: the reply stays unmarked, then the next watcher prints it', async () => {
    const s = await seedSession(db())
    const task = await seedTask(db(), s, { needs: QUESTION })
    const before = await postReply(db(), task, 'comment', 'before')
    const first = await finished(startWatcher(['--agent', s.agentId]))
    expect(first.lines).toEqual([replyLine(task.id, 'comment', before, 'before')])

    // That watcher has exited and none is running for the session.
    const answer = await postReply(db(), task, 'answer', 'release branch')
    await oneWatcherRun(db())
    expect((await readComment(db(), answer)).deliveredAt).toBeNull()

    const next = await finished(startWatcher(['--agent', s.agentId]))
    expect(next.lines).toEqual([replyLine(task.id, 'answer', answer, 'release branch')])
    expect(next.code).toBe(0)
    expect((await readComment(db(), answer)).deliveredAt).toEqual(expect.any(Number))
    expect((await readTask(db(), task.id)).needs).toBeNull()
  }, 40_000)
})
```

### tests/emulator\board-replies-anywhere-r1-6.test.ts

```ts
// board-replies-anywhere R1, criterion 6: two watchers for the same session at once print each
// reply exactly once between them (claiming is one transaction; a watcher whose replies were all
// claimed by the other goes back to waiting). The watchers spawned against the emulator.
import { describe, expect, it } from 'vitest'
import {
  finished,
  oneWatcherRun,
  postReply,
  readComment,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
  type WatcherExit,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

describe('R1-6 two watchers, one session: each reply printed once', () => {
  it.each([
    ['replies already waiting when both start', false],
    ['replies arriving while both wait', true],
  ])(
    '%s',
    async (_name, bothWaitFirst) => {
      const s = await seedSession(db())
      const tasks = [await seedTask(db(), s), await seedTask(db(), s)]
      const expected: string[] = []
      const post = async (i: number, text: string) => {
        const task = tasks[i % 2]
        expected.push(
          replyLine(task.id, 'comment', await postReply(db(), task, 'comment', text), text)
        )
      }
      if (!bothWaitFirst) for (let i = 0; i < 3; i++) await post(i, `reply ${i}`)
      const watchers = [startWatcher(['--agent', s.agentId]), startWatcher(['--agent', s.agentId])]
      if (bothWaitFirst) {
        await oneWatcherRun(db())
        for (let i = 0; i < 3; i++) await post(i, `reply ${i}`)
      }

      // Once one has exited, a last reply lets one still waiting finish; if neither is, a third
      // watcher picks that reply up.
      await finished({ exited: Promise.race(watchers.map((w) => w.exited)) })
      await post(3, 'last')
      const runs: WatcherExit[] = []
      for (const w of watchers) runs.push(await finished(w))
      if (!runs.some((r) => r.lines.includes(expected[3])))
        runs.push(await finished(startWatcher(['--agent', s.agentId])))

      expect(runs.flatMap((r) => r.lines).sort()).toEqual([...expected].sort())
      for (const r of runs) expect(r.code).toBe(0)
      for (const line of expected) {
        const { id } = JSON.parse(line) as { id: string }
        expect((await readComment(db(), id)).deliveredAt).toEqual(expect.any(Number))
      }
    },
    60_000
  )
})
```

### tests/emulator\board-replies-anywhere-r1-7.test.ts

```ts
// board-replies-anywhere R1, criterion 7: a watcher that cannot deliver says why in one stdout line
// and exits with a failure code instead of waiting: board offline, unknown session, or a session
// whose agent has shut down (lastSeen 0) at start or while it waits; each stores a WARNING
// api_call_failed through logFailure (none can be stored while the board is offline). Arguments
// other than exactly `--agent <1-64 of [A-Za-z0-9_-]>` exit 2 before any board access. The watcher
// and the real agent spawned against the emulator.
import type { DocumentData } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import {
  finished,
  oneWatcherRun,
  seedSession,
  startSession,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

// The stored failure events with this status since `since`.
async function stored(status: string, since: number): Promise<DocumentData[]> {
  const snap = await db().collection('logs').where('context.status', '==', status).get()
  return snap.docs.map((d) => d.data()).filter((e) => (e.ts as number) >= since)
}
const warning = (target: string, status: string) =>
  expect.objectContaining({
    severity: 'WARNING',
    event_type: 'api_call_failed',
    source: 'server',
    context: expect.objectContaining({ target, status }),
  })

describe('R1-7 a watcher that cannot deliver fails loudly at once', () => {
  it('board offline: one line saying so, exit 1', async () => {
    const run = await finished(startWatcher(['--agent', 'someone'], { offline: true }))
    expect(run.lines).toHaveLength(1)
    expect(run.lines[0]).toMatch(/^kanban watcher: board offline: \S/)
    expect(run.code).toBe(1)
  })

  it('unknown session (a valid 64-character id): one line, exit 1, stored warning', async () => {
    const since = Date.now()
    const id = `${'a'.repeat(31)}_-${'Z9'.repeat(15)}x`
    expect(id).toHaveLength(64)
    const run = await finished(startWatcher(['--agent', id]))
    expect(run.lines).toEqual([`kanban watcher: unknown session ${id}`])
    expect(run.code).toBe(1)
    expect(await stored('unknown_session', since)).toContainEqual(
      warning('watcher', 'unknown_session')
    )
  })

  it('session already shut down at start: one line, exit 1, stored warning', async () => {
    const since = Date.now()
    const s = await seedSession(db(), { lastSeen: 0 })
    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines).toEqual([`kanban watcher: session ${s.agentId} has shut down`])
    expect(run.code).toBe(1)
    expect(await stored('shut_down', since)).toContainEqual(warning('watcher', 'shut_down'))
  })

  it('the session’s agent shuts down while the watcher waits: it stops at once', async () => {
    const session = await startSession('r1-7')
    try {
      const w = startWatcher(['--agent', session.agentId])
      await oneWatcherRun(db())
      await session.close()
      const run = await finished(w, 10_000)
      expect(run.lines).toEqual([`kanban watcher: session ${session.agentId} has shut down`])
      expect(run.code).toBe(1)
    } finally {
      await session.close()
    }
  }, 40_000)

  it.each([
    ['no arguments', []],
    ['--agent without an id', ['--agent']],
    ['an empty id', ['--agent', '']],
    ['an id with a space', ['--agent', 'a b']],
    ['an id with a slash', ['--agent', 'a/b']],
    ['a 65-character id', ['--agent', 'a'.repeat(65)]],
    ['two --agent', ['--agent', 'a', '--agent', 'b']],
    ['an extra argument', ['--agent', 'a', 'extra']],
    ['another flag', ['--session', 'a']],
  ])('invalid arguments (%s): one line, exit 2, before touching the board', async (_n, args) => {
    // Offline env: had it reached for the board first it would report the board instead.
    const run = await finished(startWatcher(args, { offline: true }))
    expect(run.lines).toHaveLength(1)
    expect(run.lines[0]).toMatch(/^kanban watcher: invalid arguments/)
    expect(run.code).toBe(2)
  })
})
```

### tests/emulator\board-replies-anywhere-r1-8.test.ts

```ts
// board-replies-anywhere R1, criterion 8: the agent no longer pushes James's comments and answers
// into its session as channel events and never marks them received itself, so a session started
// with the channel option gets them through its watcher like any other; queued-task announcements
// still arrive on the channel, and kanban_start_task still reroutes a task's waiting replies to the
// session that takes it. The real agent over stdio (channel capability on) and the watcher.
import { describe, expect, it } from 'vitest'
import { initialTaskFields } from '../../packages/shared/src/index.ts'
import {
  QUESTION,
  finished,
  postReply,
  readTask,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
  useSession,
  type Notice,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const session = useSession('r1-8')
const fromJames = (n: Notice) =>
  n.method === 'notifications/claude/channel' && n.params?.meta?.from === 'james'

describe('R1-8 the agent leaves replies to the watcher', () => {
  it('no channel push and no marking by the agent; queued announcements unchanged', async () => {
    const s = session()
    const { id } = await s.json<{ id: string }>('kanban_create_task', {
      title: 'R1-8 channel',
      type: 'feature',
    })
    await s.json('kanban_ask', { task_id: id, question: 'Which branch?' })
    const task = { id, projectId: s.projectId, agentId: s.agentId }
    const comment = await postReply(db(), task, 'comment', 'looking now')
    const answer = await postReply(db(), task, 'answer', 'main')

    // The agent's listeners are live: a task James queues afterwards is still announced.
    const queued = db().collection('tasks').doc()
    await queued.set(
      initialTaskFields({
        projectId: s.projectId,
        type: 'chore',
        title: 'R1-8 queued',
        description: '',
        createdBy: 'james',
        afterDeploy: [],
        now: Date.now(),
      })
    )
    await s.notice(
      (n) => n.params?.meta?.kind === 'queued' && n.params.meta.task === queued.id,
      'queued announcement'
    )
    expect(s.notices().filter(fromJames)).toEqual([])
    expect((await readTask(db(), id)).needs).toEqual({
      kind: 'question',
      question: 'Which branch?',
    })

    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(s.notices().filter(fromJames)).toEqual([])
    expect(run.lines).toEqual([
      replyLine(id, 'comment', comment, 'looking now'),
      replyLine(id, 'answer', answer, 'main'),
    ])
    expect(run.code).toBe(0)
  }, 40_000)

  it('kanban_start_task reroutes a left-behind task’s waiting reply to this session’s watcher', async () => {
    const s = session()
    const gone = await seedSession(db(), { projectId: s.projectId, lastSeen: 0 })
    const task = await seedTask(db(), gone, { working: false, needs: QUESTION })
    const reply = await postReply(db(), task, 'answer', 'use the release branch')

    const r = await s.json<{ watcher: string }>('kanban_start_task', { task_id: task.id })
    const run = await finished(startWatcher([], { command: r.watcher }))
    expect(run.lines).toEqual([replyLine(task.id, 'answer', reply, 'use the release branch')])
    expect(run.code).toBe(0)
    expect(s.notices().filter(fromJames)).toEqual([])
  }, 40_000)
})
```

### tests/emulator\board-replies-anywhere-r1-9.test.ts

```ts
// board-replies-anywhere R1, criterion 9: kanban_answered_in_session { task_id, answer } records an
// answer James gave in the session's own chat: the task stops asking for him, the thread shows a
// session message "James answered in the session: <answer>", and any James answer still waiting on
// that task is marked so no later watcher prints it. The task must be bound to this session and
// have an open question; the answer is trimmed, 1-2000 characters. The real agent over stdio.
import { describe, expect, it } from 'vitest'
import { deliveryState } from '../../packages/shared/src/index.ts'
import {
  QUESTION,
  finished,
  postReply,
  readComment,
  readComments,
  readTask,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
  useSession,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const session = useSession('r1-9')
const TOOL = 'kanban_answered_in_session'

// A task bound to this session, waiting on a question asked with kanban_ask.
async function askedTask(question = 'Which branch?') {
  const s = session()
  const { id } = await s.json<{ id: string }>('kanban_create_task', {
    title: 'R1-9',
    type: 'bugfix',
  })
  await s.json('kanban_ask', { task_id: id, question })
  return { id, projectId: s.projectId, agentId: s.agentId }
}

describe('R1-9 an answer given in the session', () => {
  it('is a listed tool taking task_id and answer, both required', async () => {
    const tool = (await session().tools()).find((t) => t.name === TOOL)
    expect(tool).toBeDefined()
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual(['answer', 'task_id'])
    expect([...(tool!.inputSchema.required ?? [])].sort()).toEqual(['answer', 'task_id'])
  })

  it('clears the question, posts the session message, and no watcher prints the board answer', async () => {
    const s = session()
    const task = await askedTask()
    const waiting = await postReply(db(), task, 'answer', 'main, from the phone')

    const r = await s.call(TOOL, { task_id: task.id, answer: '  the release branch \n' })
    expect(r.isError).toBe(false)
    const { id } = JSON.parse(r.text) as { id: string }
    expect(JSON.parse(r.text)).toEqual({ id: expect.any(String) })

    expect((await readTask(db(), task.id)).needs).toBeNull()
    const note = (await readComments(db(), task.id)).find((c) => c.id === id)
    expect(note).toMatchObject({
      kind: 'info',
      body: 'James answered in the session: the release branch',
      deliveredAt: expect.any(Number),
    })
    expect(note!.author).not.toBe('james')
    expect(deliveryState(await readComment(db(), waiting))).toBe('delivered')

    const w = startWatcher(['--agent', s.agentId])
    const later = await postReply(db(), task, 'comment', 'thanks')
    const run = await finished(w)
    expect(run.lines).toEqual([replyLine(task.id, 'comment', later, 'thanks')])
  }, 40_000)

  it('takes an answer of exactly 2000 characters', async () => {
    const task = await askedTask()
    const r = await session().call(TOOL, { task_id: task.id, answer: 'x'.repeat(2000) })
    expect(r.isError).toBe(false)
    expect((await readTask(db(), task.id)).needs).toBeNull()
  })

  it.each([
    ['blank', '   '],
    ['2001 characters', 'x'.repeat(2001)],
  ])('refuses a %s answer and changes nothing', async (_n, answer) => {
    const task = await askedTask()
    const r = await session().call(TOOL, { task_id: task.id, answer })
    expect(r).toMatchObject({ isError: true, text: expect.stringMatching(/^invalid answer/) })
    expect((await readTask(db(), task.id)).needs).toEqual({
      kind: 'question',
      question: 'Which branch?',
    })
  })

  it('refuses a task with no open question', async () => {
    const s = session()
    const { id } = await s.json<{ id: string }>('kanban_create_task', {
      title: 'R1-9',
      type: 'chore',
    })
    const r = await s.call(TOOL, { task_id: id, answer: 'main' })
    expect(r).toMatchObject({ isError: true, text: expect.stringMatching(/^no open question/) })
  })

  it('refuses a task bound to another session and leaves its question open', async () => {
    const s = session()
    const other = await seedSession(db(), { projectId: s.projectId })
    const task = await seedTask(db(), other, { needs: QUESTION })
    const r = await s.call(TOOL, { task_id: task.id, answer: 'main' })
    expect(r).toMatchObject({
      isError: true,
      text: expect.stringContaining('not bound to this session'),
    })
    expect((await readTask(db(), task.id)).needs).toEqual(QUESTION)
  })
})
```

### tests/emulator\board-replies-anywhere-r1-10.test.ts

```ts
// board-replies-anywhere R1, criterion 10: the session instructions (SESSION_INSTRUCTIONS) no
// longer say James's replies arrive as channel events; they tell every session to start the
// `watcher` command from kanban_create_task / kanban_start_task as a background command
// (run_in_background), to treat each line it prints as James's own words, to start it again after
// each reply, and to record an answer given in chat with kanban_answered_in_session. kanban_ask's
// description and result note say the answer arrives through the watcher. Each rule is checked
// within one paragraph or numbered step; kanban_ask through the real agent over stdio.
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../../packages/agent/src/instructions.ts'
import { useBoardDb, useSession } from '../fixtures/board-replies-anywhere-emulator.ts'

useBoardDb()
const session = useSession('r1-10')

// The paragraphs and numbered steps of the instructions, whitespace folded.
const chunks = SESSION_INSTRUCTIONS.split(/\n\s*\n|\n(?=\s*\d+\.\s)/)
  .map((c) => c.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
const saying = (...words: RegExp[]) => chunks.filter((c) => words.every((w) => w.test(c)))

describe('R1-10 the instructions and kanban_ask point at the watcher', () => {
  it('no longer say replies arrive as channel events', () => {
    expect(SESSION_INSTRUCTIONS).not.toContain('from="james"')
    expect(SESSION_INSTRUCTIONS).not.toContain('kind="answer"')
    expect(SESSION_INSTRUCTIONS).not.toMatch(
      /(answer|approval|repl(y|ies)|comments?) (arrives?|comes?) (as|through|via|on) (a |the )?(<channel|channel)/i
    )
  })

  it('start the watcher from the task result as a background command', () => {
    expect(saying(/watcher/i, /run_in_background/, /kanban_(start|create)_task/)).not.toHaveLength(
      0
    )
  })

  it('treat what the watcher prints as James’s own words', () => {
    expect(saying(/watcher|prints/i, /James/, /own words|typed/i)).not.toHaveLength(0)
  })

  it('start the watcher again after handling each reply', () => {
    expect(
      saying(/watcher/i, /again|restart/i, /(each|every) (reply|line)|after/i)
    ).not.toHaveLength(0)
  })

  it('record an answer James gave in chat with kanban_answered_in_session', () => {
    expect(
      saying(/kanban_answered_in_session/, /chat|in the session/i, /question|answer/i)
    ).not.toHaveLength(0)
  })

  it('kanban_ask: description and result note say the answer comes through the watcher', async () => {
    const s = session()
    const ask = (await s.tools()).find((t) => t.name === 'kanban_ask')
    expect(ask?.description).toMatch(/watcher/i)
    expect(ask?.description).not.toContain('<channel')
    const { id } = await s.json<{ id: string }>('kanban_create_task', {
      title: 'R1-10',
      type: 'chore',
    })
    const r = await s.json<{ note: string }>('kanban_ask', {
      task_id: id,
      question: 'Which branch?',
    })
    expect(r.note).toMatch(/watcher/i)
    expect(r.note).not.toContain('<channel')
  })
})
```

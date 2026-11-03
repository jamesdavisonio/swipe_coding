# Test-author packet — web-threads B1 (shared stage model)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot:
commit 0257b3d on branch feat/web-threads (clean tree).

## Rules (verbatim)

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

Repo-specific application of the harness rules (observed, not invented):

- Harness = vitest 3, run by root `npm test` = `vitest run tests` (root `package.json`, no
  vitest config file). Test files live in `tests/` and are TypeScript: name them
  `tests/web-threads-b1-<id>.test.ts` (this repo uses `.ts`, not `.mjs`). Existing example:
  `tests/sample.test.ts` (quoted below). There is no D1/database helper in this repo; the
  only shared "harness" is vitest itself plus Node 24. Pure functions are imported directly:
  `import { ... } from '../packages/shared/src/index.ts'` (Node 24 type-stripping + vite;
  relative `.ts` imports keep the extension, see the header comment of index.ts).
- No logger assertions apply: B1 is pure data helpers + rules/indexes files; nothing in B1
  emits taxonomy events. The taxonomy event-type list is attached for completeness only.
- Firestore rules cannot be executed here (the emulator needs Java, which is not installed,
  per AGENTS.md). For criterion 4 write a static-structure test over the rules text
  (`firestore.rules` read with `node:fs`), and state in a file-top comment that an emulator
  rules test is deferred to the first machine with Java.
- One existing integration test must be brought to the new contract by you, because its
  assertions name retired fields: `packages/agent/test/protocol.ts` (live path, excerpt
  below). Edit only the assertions that reference `status`, `subtasks`, `openQuestion`;
  keep its structure, its offline path and its tool list unchanged. It runs with
  `KANBAN_TEST_LIVE=1 npm run test:agent` against the real Firestore and needs the key on
  this machine; you may run it to see the failures but it is slow. Running `npm test` is
  enough for the red proof of the vitest files.

## Assigned criteria (from docs/features/web-threads.md, B1, verbatim)

1. Given a task of type `feature` without after-deploy steps, when its stage list is
   derived, the list is `spec → approved → build → pr → merged → main_ci → done`; with
   after-deploy steps `after_deploy` sits before `done`; `bugfix` starts at `fix` instead
   of `spec → approved → build`; `chore` is `do → done`.
2. Given a done task with `doneAt` more than 7 days ago, when any list is computed with
   "show older" off, the task is excluded; with "show older" on, or when opened by id, it
   is shown.
3. Given James's comment, when it is created, its delivery state is `sent`; when the agent
   stamps `deliveredAt` it reads `delivered`; when `workingAt` is set `working`; when
   `handledAt` is set `handled`, and the derivation never goes backwards.
4. Given the Firestore rules, when James's signed-in browser writes the new fields
   (`stage`, `needs`, `afterDone`, `log`, `doneAt`, `reopenedAt`, comment kinds, todos),
   the write succeeds; when any other principal tries, it is refused; `agents` stays
   read-only from the browser.
5. (Decision, no test) Phase 1 documents are deleted before cut-over; no compatibility
   mapping. Do not write a test for 5.

Shared requirements from the spec's "Selected new contract" that B1 must also satisfy
(write them as file `tests/web-threads-b1-contract.test.ts`):

- `appendLog` caps the on-task history at 200 entries and returns the overflow (oldest
  first) for archiving; at or under the cap nothing is archived; order is preserved.
- `isQueued`: a task is queued when its stage is the first of its stage list and it has no
  agent; binding an agent or advancing the stage un-queues it.
- `initialTaskFields` produces a task whose stage is the first stage for its type and
  after-deploy steps, with `needs: null`, `spec: null`, `afterDone` all-false matching
  `afterDeploy` length, `pr: null`, `doneAt: null`, `reopenedAt: null`, `unread: false`,
  `working: false`, `log: []`, `summary: ''`, `agentId: null`, and
  `createdAt === updatedAt === now`.
- `firestore.indexes.json` contains composite indexes tasks(projectId ASC, stage ASC,
  updatedAt DESC) and tasks(projectId ASC, doneAt DESC), and no longer contains any index
  on `status` (static JSON test; put it in the criterion-4 file as a sibling `describe`; it
  is the same "schema files" concern).

Edge cases named by the spec: `for_james` tasks have an empty stage list; `doneAt` exactly
7 days ago is still visible (the rule is "more than 7 days"); a not-done task is visible
whatever its `doneAt`; a comment with `handledAt` set but `deliveredAt` null still reads
`handled` (never backwards); `appendLog` with exactly 200 entries archives nothing and with
201 archives exactly the oldest one.

## Selected new contract (planner decisions; exact names tests may assert)

All exported from `packages/shared/src/index.ts` (the import path for tests is the index).

```ts
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
export const STAGE_LABEL: Record<Stage, string> // spec:'Spec', approved:'Approved', build:'Build', fix:'Fix', do:'Do', pr:'PR', merged:'Merged', main_ci:'Main CI', after_deploy:'After deploy', done:'Done'
export function stagesFor(type: TaskType, hasAfterDeploy: boolean): Stage[] // for_james -> []

export type NeedsKind = 'spec' | 'question' | 'pr' | 'after_deploy'
export interface Needs {
  kind: NeedsKind
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
export interface LogEntry {
  at: number
  who: 'james' | 'session' | 'system'
  text: string
}

export interface Task {
  id: string
  projectId: string
  agentId: string | null
  type: TaskType
  title: string
  description: string
  stage: Stage
  needs: Needs | null
  spec: TaskSpec | null
  afterDeploy: string[]
  afterDone: boolean[]
  pr: { number: number; url: string } | null
  summary: string
  createdBy: Author
  createdAt: number
  updatedAt: number
  doneAt: number | null
  reopenedAt: number | null
  unread: boolean
  working: boolean
  lastCommentAt: number | null
  log: LogEntry[]
}
// retired: TaskStatus, TASK_STATUSES, SubtaskStatus, Subtask, Task.status, Task.subtasks,
//          Task.openQuestion, Task.prUrl, Task.branch, TASK_TEMPLATES, subtasksFor

export type JamesCommentKind =
  'comment' | 'answer' | 'approve' | 'change_request' | 'merged' | 'reopen'
export type SessionCommentKind =
  'spec' | 'question' | 'pr' | 'after_deploy' | 'done' | 'info' | 'system'
export type CommentKind = JamesCommentKind | SessionCommentKind
export const JAMES_COMMENT_KINDS: readonly JamesCommentKind[]
export interface Comment {
  id: string
  taskId: string
  projectId: string
  agentId: string | null
  author: Author
  kind: CommentKind
  body: string
  createdAt: number
  deliveredAt: number | null
  workingAt: number | null
  handledAt: number | null
}

export type DeliveryState = 'sent' | 'delivered' | 'working' | 'handled'
export function deliveryState(
  c: Pick<Comment, 'deliveredAt' | 'workingAt' | 'handledAt'>
): DeliveryState

export const DONE_VISIBLE_MS: number // 7 * 24 * 60 * 60 * 1000
export function isDone(t: Pick<Task, 'stage'>): boolean
export function isTaskVisible(
  t: Pick<Task, 'stage' | 'doneAt'>,
  opts?: { now?: number; showOlder?: boolean }
): boolean
// not done -> true; done with doneAt null -> true; done and (now - doneAt) <= DONE_VISIBLE_MS -> true;
// older -> false unless showOlder. ("opened by id" in criterion 2 is a UI concern: the helper is
// simply not consulted there; do not test it.)
export function stageIndex(t: Pick<Task, 'stage' | 'type' | 'afterDeploy'>): number // -1 if unknown
export function isQueued(t: Pick<Task, 'stage' | 'type' | 'afterDeploy' | 'agentId'>): boolean

export const LOG_CAP: number // 200
export function appendLog(
  log: readonly LogEntry[],
  entry: LogEntry
): { log: LogEntry[]; archived: LogEntry[] }

export function initialTaskFields(input: {
  projectId: string
  type: TaskType
  title: string
  description: string
  afterDeploy: string[]
  createdBy: Author
  now: number
}): Omit<Task, 'id'>
```

Firestore rules additions (criterion 4 static test may look for these):

- `match /tasks/{id}/log_archive/{entry} { allow read, write: if isOwner(); }`
- James's comment `create` additionally requires `request.resource.data.kind in
['comment', 'answer', 'approve', 'change_request', 'merged', 'reopen']`.
- Unchanged and still present: `isOwner()` with both e-mails and `email_verified`, `agents`
  `allow write: if false`, `projects`/`tasks`/`todos` `allow read, write: if isOwner()`,
  the default deny block `match /{document=**} { allow read, write: if false; }`.

Agent compat (so `packages/agent` keeps working on the new shape; tool names and count are
unchanged: `kanban_list_tasks, kanban_get_task, kanban_create_task, kanban_start_task,
kanban_update_task, kanban_subtask, kanban_comment, kanban_ask, kanban_todo_for_james,
kanban_whoami`). What the tools now return or do, for the protocol test's live assertions:

- `kanban_create_task` -> brief `{ id, type, title, stage: 'spec' (feature), needs: null, mine: true }`
- `kanban_list_tasks` -> briefs; the pinned `for_james` task still first.
- `kanban_subtask { task_id, key: 'spec', status: 'awaiting_approval' }` -> task
  `needs.kind === 'spec'` (compat mapping: `awaiting_approval` on key `spec` arms the spec
  need; `status: 'done'` on a key moves `stage` to the stage after that key).
- `kanban_ask` -> Firestore task has `needs.kind === 'question'` and
  `needs.question === <text>`; James's answer being delivered clears `needs` to `null`
  (was: `status: waiting_on_james` / `openQuestion`).
- `kanban_update_task { task_id, status: 'done', summary, pr_url }` -> brief
  `stage: 'done'`; Firestore task `doneAt` is a number, `agentId === null`,
  `pr.url === pr_url`. (`status: 'in_progress'` is accepted and clears `needs`; other
  legacy statuses are no-ops on stage.)

## Output format

- Files: `tests/web-threads-b1-1.test.ts`, `-2`, `-3`, `-4` (rules + indexes static),
  `tests/web-threads-b1-contract.test.ts`, and the edited `packages/agent/test/protocol.ts`.
- Run `npm test` and report the verbatim summary: every new test must FAIL because the
  behaviour is missing (for example "stagesFor is not a function"), not because of a typo
  in the test. If anything passes, say which and why.
- Report: file list with line counts, the `npm test` tail, and any contract detail you had
  to assume that this packet did not state (so the planner can record it).

## Observed baseline (source excerpts appended below, commit 0257b3d)

### packages/shared/src/index.ts

```
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

export type TaskStatus =
  'queued' | 'in_progress' | 'waiting_on_james' | 'blocked_on_permission' | 'done' | 'orphaned'
export const TASK_STATUSES: readonly TaskStatus[] = [
  'queued',
  'in_progress',
  'waiting_on_james',
  'blocked_on_permission',
  'done',
  'orphaned',
]

export type SubtaskStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'done' | 'skipped'

export type CommentKind = 'comment' | 'question' | 'answer' | 'system'

export interface Subtask {
  key: string
  label: string
  status: SubtaskStatus
  note?: string
}

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
export const AGENT_HEARTBEAT_MS = 30_000
export const AGENT_STALE_MS = 90_000

export interface Task {
  id: string
  projectId: string
  agentId: string | null // the session currently bound to this task
  type: TaskType
  title: string
  description: string
  status: TaskStatus
  summary: string // the session's running summary / final report
  prUrl: string | null
  branch: string | null
  createdBy: Author
  createdAt: number
  updatedAt: number
  subtasks: Subtask[]
  openQuestion: string | null // set by kanban_ask, cleared when James answers
  lastCommentAt: number | null
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

export * from './templates.ts'
```

### packages/shared/src/templates.ts

```
import type { Subtask, TaskType } from './index.ts'

// Subtask templates per task type. The agent advances them with kanban_subtask;
// `awaiting_approval` steps light up an Approve button on the phone.
export const TASK_TEMPLATES: Record<TaskType, { key: string; label: string }[]> = {
  feature: [
    { key: 'spec', label: 'Write spec' },
    { key: 'spec_approved', label: 'Spec approved by James' },
    { key: 'implement', label: 'Implement' },
    { key: 'pr_open', label: 'Open PR' },
    { key: 'done', label: 'Done' },
  ],
  bugfix: [
    { key: 'reproduce', label: 'Reproduce' },
    { key: 'fix', label: 'Fix' },
    { key: 'pr_open', label: 'Open PR' },
    { key: 'done', label: 'Done' },
  ],
  chore: [
    { key: 'do', label: 'Do it' },
    { key: 'done', label: 'Done' },
  ],
  for_james: [],
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  feature: 'Feature',
  bugfix: 'Bug fix',
  chore: 'Chore',
  for_james: 'For James',
}

export function subtasksFor(type: TaskType): Subtask[] {
  return TASK_TEMPLATES[type].map((t) => ({ key: t.key, label: t.label, status: 'pending' }))
}

// Every project gets exactly one pinned task of this type; its id is derived so
// agents and the UI can address it without a query.
export function forJamesTaskId(projectId: string): string {
  return `for-james-${projectId}`
}
```

### firestore.rules

```
rules_version = '2';

// Single-owner board. The browser signs in with Google as the owner; desktop agents
// and hooks use the Admin SDK, which bypasses these rules entirely. So anything an
// authenticated client can do here is James acting from the UI.
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner() {
      return request.auth != null
        && request.auth.token.email in ['j@nullnoise.ai', 'james@nullnoise.ai']
        && request.auth.token.email_verified == true;
    }

    // The UI may never impersonate an agent.
    function authoredByJames() {
      return request.resource.data.author == 'james';
    }

    match /projects/{id}  { allow read, write: if isOwner(); }
    match /agents/{id}    { allow read: if isOwner(); allow write: if false; }
    match /tasks/{id}     { allow read, write: if isOwner(); }
    match /todos/{id}     { allow read, write: if isOwner(); }

    match /comments/{id} {
      allow read: if isOwner();
      allow create: if isOwner() && authoredByJames();
      // Edits/deletes of own comments only; agent comments are immutable from the UI.
      allow update, delete: if isOwner() && resource.data.author == 'james' && authoredByJames();
    }

    // Default deny: anything not matched above (scripts/check-firestore-rules.mjs insists).
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### firestore.indexes.json

```
{
  "indexes": [
    {
      "collectionGroup": "comments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "taskId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "comments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "agentId", "order": "ASCENDING" },
        { "fieldPath": "deliveredAt", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "todos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "done", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### tests/sample.test.ts

```
// Toolchain proof for setup-project. The failing variant (expect(1 + 1).toBe(3)) was run
// first and recorded in the skeleton commit message; this placeholder keeps the suite green.
import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('placeholder passing test — vitest runs under Node 24', () => {
    expect(1 + 1).toBe(2)
  })
})
```

### packages/agent/test/protocol.ts (live-path excerpt, lines 150-280)

```ts
    missing.length === 0,
    `all ${EXPECTED_TOOLS.length} tools listed${missing.length ? ` (missing ${missing.join(', ')})` : ''}`
  )

  const who = await call<Whoami>('kanban_whoami')
  assert(
    typeof who.cwd === 'string' && who.board?.mode,
    `whoami works (board ${who.board?.mode ?? 'none'})`
  )

  if (!withBoard) {
    const offId = send('tools/call', { name: 'kanban_list_tasks', arguments: {} })
    const r = await waitFor((m) => m.id === offId, 'offline list')
    assert(
      r.result?.isError && /offline/.test(r.result.content?.[0]?.text ?? ''),
      'board tools report offline cleanly'
    )
    console.log('skipped Firestore checks (no emulator)')
  } else {
    const { initializeApp, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    if (getApps().length === 0) {
      if (live) {
        const { cert } = await import('firebase-admin/app')
        const { readFileSync } = await import('node:fs')
        const sa = JSON.parse(readFileSync(saPath, 'utf8')) as ServiceAccount & {
          project_id?: string
        }
        initializeApp({ credential: cert(sa), projectId: sa.project_id })
      } else {
        initializeApp({ projectId })
      }
    }
    const db = getFirestore()

    const task = await call<TaskBrief>('kanban_create_task', {
      title: 'Protocol test task',
      type: 'feature',
      description: 'created by test',
    })
    assert(
      task.id && task.status === 'in_progress' && /spec:pending/.test(task.subtasks ?? ''),
      `create_task → ${task.id}`
    )

    const listed = await call<TaskBrief[]>('kanban_list_tasks')
    assert(
      listed.some((t) => t.id === task.id) && listed[0]?.type === 'for_james',
      'list_tasks shows it, For James pinned first'
    )

    const t0 = Date.now()
    const cRef = db.collection('comments').doc()
    await cRef.set({
      taskId: task.id,
      projectId: who.projectId,
      agentId: who.agentId,
      author: 'james',
      kind: 'comment',
      body: 'Looks good, carry on.',
      createdAt: t0,
      deliveredAt: null,
    })
    const ev = await waitFor(
      (m) => m.method === 'notifications/claude/channel' && m.params?.meta?.id === cRef.id,
      'channel notification'
    )
    assert(
      ev.params?.content === 'Looks good, carry on.',
      `channel event delivered in ${Date.now() - t0} ms`
    )
    const meta = ev.params?.meta
    assert(
      meta?.from === 'james' && meta.task === task.id && meta.kind === 'comment',
      `meta ${JSON.stringify(meta)}`
    )
    for (let i = 0; i < 40 && (await cRef.get()).get('deliveredAt') == null; i++)
      await new Promise((r) => setTimeout(r, 100))
    assert((await cRef.get()).get('deliveredAt') != null, 'deliveredAt set after delivery')

    await call('kanban_subtask', { task_id: task.id, key: 'spec', status: 'awaiting_approval' })
    await call('kanban_ask', { task_id: task.id, question: 'Approve the spec?' })
    let snap = await db.collection('tasks').doc(task.id).get()
    assert(
      snap.get('status') === 'waiting_on_james' && snap.get('openQuestion') === 'Approve the spec?',
      'ask → waiting_on_james + openQuestion'
    )

    const aRef = db.collection('comments').doc()
    await aRef.set({
      taskId: task.id,
      projectId: who.projectId,
      agentId: who.agentId,
      author: 'james',
      kind: 'answer',
      body: 'Approved.',
      createdAt: Date.now(),
      deliveredAt: null,
    })
    await waitFor(
      (m) => m.method === 'notifications/claude/channel' && m.params?.meta?.id === aRef.id,
      'answer notification'
    )
    for (let i = 0; i < 40; i++) {
      snap = await db.collection('tasks').doc(task.id).get()
      if (snap.get('status') === 'in_progress') break
      await new Promise((r) => setTimeout(r, 100))
    }
    assert(
      snap.get('status') === 'in_progress' && snap.get('openQuestion') === null,
      'answer → in_progress, question cleared'
    )

    const todo = await call<{ id: string }>('kanban_todo_for_james', {
      body: 'Merge the PR',
      link: 'https://example.com/pr/1',
      task_id: task.id,
    })
    assert(todo.id, 'todo_for_james created')

    const done = await call<TaskBrief>('kanban_update_task', {
      task_id: task.id,
      status: 'done',
      summary: 'All good.',
      pr_url: 'https://example.com/pr/1',
    })
    assert(
      done.status === 'done' &&
        /pr_open:done/.test(done.subtasks ?? '') &&
        /done:done/.test(done.subtasks ?? ''),
      'update_task done closes template steps'
```

### logging/taxonomy.json event types

```
feature_error
api_call_failed
validation_failed
session_start
session_end
user_action
milestone_reached
cache_miss
duplicate_suppressed
write_conflict
access_denied
unclassified
```

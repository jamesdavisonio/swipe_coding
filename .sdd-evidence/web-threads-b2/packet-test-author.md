# Test-author packet — web-threads B2 (Threads home)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot: commit
6d0c0e3 on branch feat/web-threads-b2 (clean tree). B1 (shared stage model) is merged; its
helpers in `packages/shared` are real and may be used in fixtures.

## Rules (verbatim)

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

Repository notes on those rules: this repo is TypeScript, so test files are `.test.tsx`
(not `.mjs`); there is no D1 helper. The observed harness is vitest 3 + Testing Library +
jsdom (installed in commit cc5042b, described under "Execution harness" below). `tests/fixtures/`
exists and is empty; one shared fixture module there is allowed.

## Assigned criteria (from docs/features/web-threads.md, verbatim)

### B2 — Threads home

6. Given tasks across projects, when Threads opens, rows are ordered needs-you first,
   then unread, then most recently updated; a "Needs you" section precedes "Quiet"; the
   header badge shows the total needing him for the current filter, or "Nothing needs you".
7. Given project chips, when James taps a project, only that project's rows show and the
   chip is marked pressed; each chip shows its own needs-you count; "All" resets.
8. Given a project with open For James items, when Threads renders, a pinned "For James ·
   <project>" row shows the open count and newest time, sorted with the task rows.
9. Given a task that needs him, when its row renders, the quick replies match the kind:
   spec → Approve spec, Small change…, Read more; question → one chip per option (key ·
   label) + Read more; pr → Open PR #n (external link), Merged it, Read more;
   after_deploy → Open the N steps.
10. Given a task done more than 7 days ago, when Threads renders, it is absent (see 2).
11. Given a row, when James taps its title area, the thread opens and the task's unread
    flag clears; when he taps a quick reply, the action in 15–22 happens without leaving
    Threads.
12. Given the bottom nav, when the current screen is Threads/thread, Projects/project or
    New task, the matching item is marked current; the Threads item carries the total
    needs-you count.

Criterion 11 refers to "the action in 15–22"; the B2 contract below fixes what that means
for B2 (the right action is dispatched; its effects are B4's).

Criterion 10 points to criterion 2 (B1, already shipped):

2. Given a done task with `doneAt` more than 7 days ago, when any list is computed with
   "show older" off, the task is excluded; with "show older" on, or when opened by id, it
   is shown.

Shared criteria that apply to this screen (Threads and the bottom nav only; the other
screens are later behaviours):

29. Given any screen, when loading, an unobtrusive loading state shows; when Firestore
    rejects a read, an error state with a retry shows; empty lists have the prototype's
    empty copy.
30. Given keyboard-only use, when traversing any screen, every control is reachable, has a
    visible focus ring and an accessible name; chips expose `aria-pressed`; nav exposes
    `aria-current`.

Criterion 30 in jsdom: keyboard reachability (`userEvent.tab()` order), accessible names,
`aria-pressed` and `aria-current` are observable; whether the focus ring is visible is a CSS
concern jsdom cannot render, so it is checked at review, not asserted.

Not assigned to B2: criterion 28 (offline replies — B3/B4), the thread view (B3), the
decision sheet's contents (B4), Projects and New task screens (B5), history and reopen (B6).

## Selected new contract (planner decisions, recorded in the spec; exact names tests may assert)

**B2 contract details fixed at test time** (planner decisions, 2026-11-03):

- Screen and routes: `packages/web/src/pages/Threads.tsx` (default export, no props) is the
  `/` route. The project filter lives in the `project` search param of `/` (`/?project=<id>`,
  absent = All), so going back from a thread keeps it (criterion 15). Until B5 the Phase 1
  project list moves to `/projects`; `/new` is B5's screen and the nav already links to it.
- Pure helpers in `packages/web/src/lib/threads.ts`:
  - `threadRows({ tasks, todos, filter, now? })` returns `ThreadRow[]`, where a row is
    `{ kind: 'task', task, at: task.updatedAt, needs: task.needs !== null, unread: task.unread }`
    or `{ kind: 'for_james', projectId, todos (the open ones, newest first), at: newest open
todo createdAt, needs: true, unread: false }`. It holds every visible task
    (`isTaskVisible`, show older off) except type `for_james`, plus one `for_james` row per
    project with at least one open todo; `filter` is `'all'` or a project id; order is needs
    first, then unread, then `at` newest first.
  - `needsCount({ tasks, todos, projectId?, now? })` counts visible non-`for_james` tasks
    with a need plus open todos, for one project or for all (`projectId` absent or `'all'`).
  - `stageText(task)`: `Done` when done; with a need, spec `Spec · needs you`, question
    `Question for you`, pr `PR ready · needs you`, after_deploy `After deploy · needs you`;
    otherwise spec `Writing spec`, approved `Approved`, build `Building`, fix `Fixing`, do
    `Doing`, pr `PR open`, merged `Merged`, main_ci `Waiting for CI on main`, after_deploy
    `After deploy`; a stage outside `STAGES` gives `Unknown stage` (shape guard, no crash).
- Data layer (`packages/web/src/data.ts`): `Live<T>` gains `retry(): void` (re-subscribes);
  new `useAllTasks()` (`Live<Task[]>`, every task, filtered client-side) and `useAgents()`
  (`Live<AgentDoc[]>`, for the live dot); existing `useProjects()` and `useOpenTodos()`.
  Actions: existing `approveSpec(task)`; new `answerQuestion(task, option: { key, label })`,
  `markMerged(task)` and `markRead(task)`. B2 asserts that the right action is called with
  the right task and value and that Threads stays on screen. What each action records
  (history entries, message bodies) is B4's criteria 16–19, tested there in the emulator.
  B2's minimal writes: answer creates James's comment of kind `answer` with the option label
  and clears the need; merged is a transaction guarded on stage `pr` that moves to `merged`,
  creates kind `merged` "Merged it." and clears the need; markRead sets `unread: false`.
- Rows: a task row's open control is a button whose name contains the title; tapping it
  navigates to `/t/:id` and calls `markRead(task)` only when `task.unread`. Its meta line is
  `<project name> · <stageText>` with a relative time. The For James row is a button named
  `For James · <project name>` showing `N thing(s) to do by hand` ("1 thing", "2 things") and
  the newest time; tapping it navigates to `/p/:projectId?tab=james`.
- Quick replies (criterion 9): spec gives buttons `Approve spec`, `Small change…` (U+2026)
  and `Read more`; question gives one button per option labelled `<key> · <label>`, then
  `Read more` (no options: `Read more` only); pr gives the link `Open PR #<n>` (href
  `pr.url`, `target="_blank"`, `rel` containing `noopener`) only when `pr` is set, then
  buttons `Merged it` and `Read more`; after_deploy gives the button `Open the N steps`
  (`Open the 1 step` for one). `Read more` and `Open the N steps` open the decision sheet in
  mode `read`, `Small change…` in mode `change`. `packages/web/src/components/DecisionSheet.tsx`
  has a default export with props `{ task: Task; mode: 'read' | 'change'; onClose: () => void }`,
  rendered by Threads while open; its contents are B4's, so B2 tests may mock the module.
- Header and chips: heading `Threads`; `N need you` for the current filter, or
  `Nothing needs you`. Sections headed `Needs you` and `Quiet`, each only when non-empty.
  Chips are `All` then one per project (`useProjects`, by name), each a button with
  `aria-pressed`, showing its needs count when it is above zero.
- States (criterion 29, this screen): while tasks, todos or projects are loading, an element
  with `role="status"` named `Loading threads`; on a read error, the text
  `Couldn't load threads` and a `Retry` button that calls `retry()` on each failed source;
  with no rows, `No threads for this project.`
- `packages/web/src/components/BottomNav.tsx`: default export, no props, rendered by Threads
  and the later list screens but not the thread view. A `nav` named `Main` with links
  `Threads` (`/`), `Projects` (`/projects`) and `New task` (`/new`); `aria-current="page"` on
  Threads for `/` and `/t/*`, Projects for `/projects` and `/p/*`, New task for `/new`. The
  Threads link shows the all-projects needs count when above zero; the nav reads the hooks
  itself.
- Instrumentation: `packages/web/src/lib/log.ts` exports `log`, the shared browser logger
  (`initLogger` from `logging/logger.browser.js`, `source: 'web_client'`, manifest values
  from `app.manifest.yaml`). Threads emits `log.event('user_action', { feature:
'web-threads', action, target })` with action `filter` (target: project id or `all`),
  `open_thread`, `approve_spec`, `answer` or `merged` (target: task id).

- Fidelity round 1 decisions: a rejected read is logged by the read hooks in `data.ts`
  (`log.error('api_call_failed', …, { feature: 'web-threads', target: 'firestore', action:
'read', status: <error code> })`), not by the screen, so the Threads tests (which mock
  `data.ts`) assert no read-error logging. Chips are labelled by project name and keep the
  order `useProjects()` returns (most recently updated first). Threads and BottomNav import
  only `useAllTasks`, `useOpenTodos`, `useProjects`, `useAgents`, `approveSpec`,
  `answerQuestion`, `markMerged` and `markRead` from `data.ts`.

Instrumentation definitions (spec, Instrumentation section): `user_action`, severity INFO,
context `feature`, `action`, `target`; audience internal. `logging/taxonomy.json` entry:

```json
    "user_action": {
      "severity_hint": "INFO",
      "desc": "Meaningful user interaction",
      "required_context": ["action"]
    },
```

## Execution harness (observed, commit cc5042b)

- `npm test` runs `vitest run` with `vitest.config.ts` (quoted below): files
  `tests/**/*.test.{ts,tsx}`, JSX via React's automatic runtime. A component test opts into
  jsdom with the first line `// @vitest-environment jsdom`.
- Installed: `@testing-library/react@16` (`render`, `screen`, `within`, `cleanup`),
  `@testing-library/user-event@14`, `@testing-library/dom@10`, `jsdom@26`, React 19,
  `react-router-dom@7` (`MemoryRouter`, `Routes`, `Route`, `useLocation`). There are no
  jest-dom matchers: use `getAttribute`, `textContent`, `toBeTruthy`, `queryBy…` + `toBeNull`.
  Call `cleanup()` in `afterEach`.
- Imports from tests use relative paths with extensions, as the B1 tests do:
  `../packages/shared/src/index.ts`, `../packages/web/src/pages/Threads.tsx`.
- The Firestore boundary is `packages/web/src/data.ts` (it imports `db` from `firebase.ts`,
  which needs the Firebase web config). Component tests mock that module with
  `vi.mock('../packages/web/src/data.ts', () => ({ ... }))`, supplying the hooks as functions
  returning `Live` objects (`{ data, loading, error, retry }`) and the actions as `vi.fn()`
  spies; use `vi.hoisted` for spies referenced inside the factory. Mock
  `../packages/web/src/lib/log.ts` the same way (`{ log: { event: vi.fn(), info: vi.fn(),
warn: vi.fn(), error: vi.fn() } }`) to observe events. `DecisionSheet` may be mocked with a
  stand-in that renders its `mode` and task title so the test can see what opened.
- The pure helpers in `lib/threads.ts` are tested for real, without mocks, passing `now`.
- Components read `Date.now()`; when a time matters, fake only the clock:
  `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(NOW)`, restored in
  `afterEach`.
- Navigation is observed by rendering inside `<MemoryRouter initialEntries={[...]}>` with a
  `Routes` that also mounts a probe element on the destination paths (or a component that
  prints `useLocation()`).
- Fixture base: `initialTaskFields(...)` from `packages/shared` returns a complete task
  minus `id`; spread overrides on top.
- Lint runs on tests at commit (`eslint` via lint-staged); the `no-unsafe-*` rules are off
  for `tests/**` because red tests import modules that do not exist yet.

## Output format

- Files: `tests/web-threads-b2-6.test.tsx` … `tests/web-threads-b2-12.test.tsx` (one per
  criterion), `tests/web-threads-b2-29.test.tsx` and `tests/web-threads-b2-30.test.tsx`
  (Threads and BottomNav only), plus optionally one fixture module under `tests/fixtures/`.
- Run `npx vitest run tests/web-threads-b2` and report the verbatim summary: every new test
  must FAIL because the behaviour is missing (for example a module that does not resolve
  yet or an export that is not a function), not because of a mistake in the test. If
  anything passes, say which and why.
- Report: file list with line counts, the vitest tail, and any contract detail you had to
  assume that this packet did not state (so the planner can record it).

## Observed baseline (source excerpts, commit cc5042b)

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'

// `npm test`: every unit test under tests/, except the Firestore rules suite, which needs
// the emulator and runs through `npm run test:rules` (vitest.rules.config.ts).
// Web component tests are .test.tsx files that opt into jsdom with a
// `// @vitest-environment jsdom` docblock; JSX uses React's automatic runtime like the app.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/rules/**', '**/node_modules/**'],
  },
})
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
export const AGENT_HEARTBEAT_MS = 30_000
export const AGENT_STALE_MS = 90_000

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
```

### packages/shared/src/templates.ts

```ts
import type { Stage, TaskType } from './index.ts'

// The stages of each task type, in order. The session advances a task along its chain;
// `after_deploy` is inserted before `done` only when the task has after-deploy steps.
const STAGES_BEFORE_DONE: Record<TaskType, Stage[]> = {
  feature: ['spec', 'approved', 'build', 'pr', 'merged', 'main_ci'],
  bugfix: ['fix', 'pr', 'merged', 'main_ci'],
  chore: ['do'],
  for_james: [],
}

export function stagesFor(type: TaskType, hasAfterDeploy: boolean): Stage[] {
  const chain = STAGES_BEFORE_DONE[type]
  if (chain.length === 0) return []
  return [...chain, ...(hasAfterDeploy ? (['after_deploy'] as const) : []), 'done']
}

export const STAGE_LABEL: Record<Stage, string> = {
  spec: 'Spec',
  approved: 'Approved',
  build: 'Build',
  fix: 'Fix',
  do: 'Do',
  pr: 'PR',
  merged: 'Merged',
  main_ci: 'Main CI',
  after_deploy: 'After deploy',
  done: 'Done',
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  feature: 'Feature',
  bugfix: 'Bug fix',
  chore: 'Chore',
  for_james: 'For James',
}

// Every project gets exactly one pinned task of this type; its id is derived so
// agents and the UI can address it without a query.
export function forJamesTaskId(projectId: string): string {
  return `for-james-${projectId}`
}
```

### packages/web/src/data.ts

```ts
// Typed live queries over Firestore onSnapshot, plus the handful of writes the UI makes.
// Every write here is James acting from the UI: author is always 'james'.
import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  COLLECTIONS,
  forJamesTaskId,
  initialTaskFields,
  isDone,
  isQueued,
  taskStages,
  type AgentDoc,
  type Comment,
  type CommentKind,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { db } from './firebase.ts'
import type { LegacyStatus } from './lib/legacy-status.ts'

export interface Live<T> {
  data: T
  loading: boolean
  error: string | null
}

// --- read hooks ---------------------------------------------------------------
// `deps` controls re-subscription; constraints are rebuilt only when deps change.

export function useCollection<T>(
  name: string,
  constraints: QueryConstraint[],
  deps: unknown[],
  enabled = true
): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: enabled, error: null })
  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const q = query(collection(db, name), ...constraints)
    return onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })),
          loading: false,
          error: null,
        }),
      (err) => setState({ data: [], loading: false, error: err.message })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, enabled, ...deps])
  return state
}

export function useDocument<T>(name: string, id: string | null | undefined): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: !!id, error: null })
  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      doc(db, name, id),
      (snap) =>
        setState({
          data: snap.exists() ? { ...(snap.data() as T), id: snap.id } : null,
          loading: false,
          error: null,
        }),
      (err) => setState({ data: null, loading: false, error: err.message })
    )
  }, [name, id])
  return state
}

// Projects, most recently touched first (single-field index).
export const useProjects = () =>
  useCollection<Project>(COLLECTIONS.projects, [orderBy('updatedAt', 'desc')], [])

// Recent tasks across all projects for the home-page counters (single-field orderBy).
export const useRecentTasks = (max = 500) =>
  useCollection<Task>(COLLECTIONS.tasks, [orderBy('updatedAt', 'desc'), limit(max)], [max])

// A project's tasks — composite index tasks(projectId, updatedAt desc).
export const useProjectTasks = (projectId: string | undefined) =>
  useCollection<Task>(
    COLLECTIONS.tasks,
    [where('projectId', '==', projectId), orderBy('updatedAt', 'desc')],
    [projectId],
    !!projectId
  )

// Open todos everywhere (single equality) — counted per project client-side.
export const useOpenTodos = () =>
  useCollection<Todo>(COLLECTIONS.todos, [where('done', '==', false)], [])

// A project's todos; sorted client-side so no composite index is needed.
export const useProjectTodos = (projectId: string | undefined) =>
  useCollection<Todo>(
    COLLECTIONS.todos,
    [where('projectId', '==', projectId)],
    [projectId],
    !!projectId
  )

// Thread for a task — composite index comments(taskId, createdAt).
export const useTaskComments = (taskId: string | undefined) =>
  useCollection<Comment>(
    COLLECTIONS.comments,
    [where('taskId', '==', taskId), orderBy('createdAt', 'asc')],
    [taskId],
    !!taskId
  )

export const useProject = (id: string | undefined) => useDocument<Project>(COLLECTIONS.projects, id)
export const useTask = (id: string | undefined) => useDocument<Task>(COLLECTIONS.tasks, id)
export const useAgent = (id: string | null | undefined) =>
  useDocument<AgentDoc>(COLLECTIONS.agents, id)

// --- writes ------------------------------------------------------------------

const now = () => Date.now()

export async function renameProject(projectId: string, name: string) {
  await updateDoc(doc(db, COLLECTIONS.projects, projectId), { name, updatedAt: now() })
}

export async function createTask(
  projectId: string,
  input: { title: string; type: TaskType; description: string }
) {
  const ref = doc(collection(db, COLLECTIONS.tasks))
  const task = initialTaskFields({
    projectId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    createdBy: 'james',
    afterDeploy: [],
    now: now(),
  })
  await setDoc(ref, task)
  await touchProject(projectId)
  return ref.id
}

// James's comment in the shape every writer uses; delivery stamps are the agent's to set.
function jamesComment(task: Task, kind: CommentKind, body: string, t: number, id: string): Comment {
  return {
    id,
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body: body.trim(),
    createdAt: t,
    deliveredAt: null,
    workingAt: null,
    handledAt: null,
  }
}

// A stage transition James owns: read the task inside a transaction and write only when
// `plan` accepts its current state, so a double tap (or a stale screen) is a no-op. The
// optional comment is created in the same transaction. Returns whether anything was written.
interface Transition {
  patch: Partial<Task>
  comment?: { kind: CommentKind; body: string }
}
async function transitionTask(
  taskId: string,
  plan: (current: Task) => Transition | null
): Promise<boolean> {
  const taskRef = doc(db, COLLECTIONS.tasks, taskId)
  const commentRef = doc(collection(db, COLLECTIONS.comments))
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(taskRef)
    if (!snap.exists()) return false
    const current = { ...(snap.data() as Task), id: snap.id }
    const next = plan(current)
    if (!next) return false
    const t = now()
    const { comment } = next
    tx.update(taskRef, {
      ...next.patch,
      updatedAt: t,
      ...(comment ? { lastCommentAt: t } : {}),
    })
    if (comment)
      tx.set(commentRef, jamesComment(current, comment.kind, comment.body, t, commentRef.id))
    return true
  })
}

// The Phase 1 menu actions (mark done, re-queue, reopen) expressed on stage and doneAt, each
// guarded on the stage it expects: done only when not done, reopen only from done, re-queue
// only when the type has a stage chain and the task is not already queued.
export async function setTaskStatus(task: Task, status: LegacyStatus) {
  await transitionTask(task.id, (cur) => {
    const chain = taskStages(cur)
    if (status === 'done')
      return isDone(cur) ? null : { patch: { stage: 'done', doneAt: now(), needs: null } }
    if (status === 'queued')
      return chain.length === 0 || isQueued(cur)
        ? null
        : {
            patch: { stage: chain[0], agentId: null, needs: null, doneAt: null, working: false },
          }
    if (status === 'in_progress')
      return isDone(cur) && chain.length > 1
        ? { patch: { stage: chain[chain.length - 2], doneAt: null, reopenedAt: now() } }
        : null
    return null
  })
}

// A comment from James. If the task was waiting on him, it is now unblocked (need cleared).
export async function addComment(task: Task, body: string) {
  const ref = doc(collection(db, COLLECTIONS.comments))
  const t = now()
  const kind = task.needs?.kind === 'question' ? 'answer' : 'comment'
  await setDoc(ref, jamesComment(task, kind, body, t, ref.id))
  const patch: Partial<Task> = { lastCommentAt: t, updatedAt: t }
  if (task.needs) patch.needs = null
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), patch)
}

// Approve only while the spec is what the task waits on (stage spec or approved).
export async function approveSpec(task: Task) {
  await transitionTask(task.id, (cur) =>
    (cur.stage === 'spec' || cur.stage === 'approved') && cur.needs?.kind === 'spec'
      ? {
          patch: { stage: 'build', needs: null },
          comment: { kind: 'approve', body: 'Approved: spec' },
        }
      : null
  )
}

export async function toggleTodo(todo: Todo) {
  await updateDoc(doc(db, COLLECTIONS.todos, todo.id), {
    done: !todo.done,
    doneAt: todo.done ? null : now(),
  })
}

export async function addTodo(projectId: string, body: string) {
  const ref = doc(collection(db, COLLECTIONS.todos))
  const todo: Todo = {
    id: ref.id,
    projectId,
    body: body.trim(),
    link: null,
    done: false,
    sourceTaskId: null,
    createdAt: now(),
    doneAt: null,
  }
  await setDoc(ref, todo)
}

async function touchProject(projectId: string) {
  await updateDoc(doc(db, COLLECTIONS.projects, projectId), { updatedAt: now() }).catch(() => {})
}

export { forJamesTaskId }
```

### packages/web/src/App.tsx

```ts
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth.tsx'
import Home from './pages/Home.tsx'
import Board from './pages/Board.tsx'
import TaskPage from './pages/Task.tsx'

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/p/:projectId" element={<Board />} />
          <Route path="/t/:taskId" element={<TaskPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  )
}
```

### logging/logger.browser.js (API excerpt)

```js
/**
 * Shared browser/SCORM logger — the ONLY way client code logs.
 * In-memory buffer → batched POST to the ingestion endpoint (max every 10 s or
 * 20 events); `navigator.sendBeacon` on pagehide/visibilitychange; silent
 * failure with bounded retry; hard cap on queue size. Logging must NEVER
 * block, throw into, or slow the host application.
 *
 * Usage (vendored governed files imported or inlined at build time):
 *
 *   import { initLogger } from './logger.browser.js';
 *   import manifest from './app.manifest.json';   // generated from app.manifest.yaml
 *   import taxonomy from './taxonomy.json';
 *   import piiKeys from './pii-keys.json';
 *   const log = initLogger({ manifest, taxonomy, piiKeys, source: 'web_client' });
 *
 * `source` is set by the BUILD ENTRY that bundles this logger, never decided at
 * runtime: the app entry passes 'web_client'; the SCORM package build passes
 * 'scorm'. It must be one of the registry entry's sources[] — the ingestion
 * endpoint drops events claiming a source the app isn't registered for.
 *
 * API is identical to the server logger:
 *   log.error / log.warn / log.info / log.event / log.critical / log.debug
 */
const log = {
  error: (type, message, context) => enqueue('ERROR', type, message, context),
  warn: (type, message, context) => enqueue('WARNING', type, message, context),
  info: (type, message, context) => enqueue('INFO', type, message, context),
  event: (type, context) => enqueue('INFO', type, type, context),
  critical: (type, message, context) => enqueue('CRITICAL', type, message, context),
  debug: (type, message, context) => enqueue('DEBUG', type, message, context),
  flush,
}
```

# Test-author packet — web-threads B3 (Thread view)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot: commit
db6450f on branch feat/web-threads-b3 (clean tree). B1 (shared model) and B2 (Threads home) are
merged; their code is real and quoted below where the thread view reuses it.

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
jsdom, and the shared fixture module is `tests/fixtures/web-threads-b2.tsx` (quoted below):
reuse its builders, mocks and render helpers by importing them. If B3 needs more (comment
builders, a thread render helper, extra mocked `data.ts` names), put them in one new module
`tests/fixtures/web-threads-b3.tsx` that imports from the B2 fixture. Do not edit the B2
fixture or any existing test file.

## Assigned criteria (from docs/features/web-threads.md, verbatim)

### B3 — Thread view

13. Given a task, when its thread opens, messages render in order: system lines (quiet,
    centred), session messages labelled by kind (Spec, Question, PR ready, After deploy,
    Done, Session), James's messages right-aligned with time and ticks; the latest
    session message of the kind currently needed carries a Read more button; a typing
    indicator shows while the task is `working`.
14. Given James types a reply and sends, when the task has an open question, the comment
    is created with kind `answer`, otherwise `comment`; it appears immediately with one
    tick; Enter inserts a newline, ⌘/Ctrl+Enter or the Send button sends; empty or
    whitespace-only text cannot be sent.
15. Given the thread header, when James taps the clock icon, the History sheet opens
    (B6); when he taps back, he returns to Threads with the same filter.

From B1, criterion 2 (its "opened by id" clause is B3's, per the B1 contract: B3's tests
must open `/t/:id` for a done task older than 7 days and render it):

2. Given a done task with `doneAt` more than 7 days ago, when any list is computed with
   "show older" off, the task is excluded; with "show older" on, or when opened by id, it
   is shown.

Shared criteria that apply to this screen (the thread view only):

28. Given no network, when James replies or ticks a step, the UI shows the change with
    one tick and the write is queued (Firestore offline persistence); when the network
    returns the ticks advance; a permanently failed write shows an inline error and the
    change is reverted.
29. Given any screen, when loading, an unobtrusive loading state shows; when Firestore
    rejects a read, an error state with a retry shows; empty lists have the prototype's
    empty copy.
30. Given keyboard-only use, when traversing any screen, every control is reachable, has a
    visible focus ring and an accessible name; chips expose `aria-pressed`; nav exposes
    `aria-current`.

For criterion 28, B3 owns the reply half only (ticking an after-deploy step is B4's).
Criterion 30 in jsdom: keyboard reachability (`userEvent.tab()` order), accessible names and
`aria-current` are observable; whether the focus ring is visible is a CSS concern jsdom
cannot render, so it is checked at review, not asserted.

Not assigned to B3: the decision sheet's contents (B4), the History sheet's contents and
Reopen (B6), Projects and New task (B5), anything the session does.

## Selected new contract (planner decisions, recorded in the spec; exact names tests may assert)

**B3 contract details fixed at test time** (planner decisions, 2026-11-03):

- Screen and route: `packages/web/src/pages/Thread.tsx` (default export, no props) is the
  `/t/:taskId` route and replaces the Phase 1 `pages/Task.tsx`. It renders any task opened by
  id, however long ago it finished (criterion 2's "opened by id" clause).
- Data layer (`packages/web/src/data.ts`): the screen reads `useTask(id)`,
  `useTaskComments(id)`, `useProjects()` and `useAgents()` (all `Live`, with `retry()`), and
  calls `newCommentId()` (a fresh comment id, generated client-side), `sendReply(task, { id,
body })`, `markRead(task)`, `approveSpec`, `answerQuestion` and `markMerged`. Those are the
  only `data.ts` names the screen and its components import. `sendReply` writes James's
  comment under the given id (so a retried write cannot duplicate it), with the body trimmed
  and capped at 4000 characters: kind `answer` with the question need cleared in the same
  write when the task's need is a question, otherwise kind `comment` with the need left as it
  is. It replaces the Phase 1 `addComment`. Its Firestore effects are tested in the emulator
  with B4's writes; B3 tests the screen.
- Offline (criterion 28, the reply half; ticking a step is B4's): Firestore is initialised
  with a persistent local cache (`persistentLocalCache` with the multi-tab manager), so a reply
  written offline is queued and the write's promise stays pending until the server accepts
  it. That configuration is checked at review; jsdom cannot exercise it.
- Messages, in `createdAt` order: a session comment of kind `system` is a centred quiet line
  with its text only. Other session comments carry a label `<Kind> · <relative time>`, where
  Kind is `Spec`, `Question`, `PR ready`, `After deploy`, `Done` for spec, question, pr,
  after_deploy, done, and `Session` for info or anything else. James's comments sit on the
  right with their relative time and a tick label from `deliveryState`: `sent`, `received`,
  `working on it`, `handled`. Only the latest session message whose kind equals the task's
  active need carries a `Read more` button, which opens `DecisionSheet` in mode `read`. While
  `task.working` is true, an element with `role="status"` named `Session is working` shows
  after the last message.
- Composer: a textarea labelled `Message to the session` and a button `Send`, disabled while
  the trimmed text is empty. Enter inserts a newline; Ctrl+Enter or ⌘+Enter sends; empty or
  whitespace-only text is never sent. Sending clears the box and shows the message at once
  as James's message with the `sent` label, before the snapshot has it; it is shown once,
  however many snapshots then contain it. If `sendReply` rejects, that message disappears,
  the text returns to the box, and an inline `role="alert"` says `Couldn't send. Try again.`
  While the write is pending (offline), the message stays with `sent`.
- While the task needs James, the composer area shows the same quick replies as Threads
  (`QuickReplies`, same actions and labels), and acting on one keeps James on the thread. A
  done task has no composer: the footer starts with `Done`. Reopen is B6's.
- Header: a button `Back to threads` goes to `location.state.from` when it is a path
  starting with `/`, else to `/`. Threads now navigates to a thread with
  `state: { from: <Threads path + search> }`, so back keeps the project filter (criterion
  15). The heading is the task title; under it `<project name> · <stageText>`, plus
  ` · session live` when one of the project's agents is online and the task is not done. A
  button `Decision history` opens `packages/web/src/components/HistorySheet.tsx` (default
  export, props `{ task: Task; onClose: () => void }`; its contents are B6's, so B3 tests
  may mock it).
- Stage stepper: `packages/web/src/components/StageStepper.tsx` (default export, props
  `{ task: Task }`) renders a list named `Stages` with one item per stage of
  `taskStages(task)`, labelled with `STAGE_LABEL`. The current stage's item has
  `aria-current="step"`; a done task, a task whose stage is not in its chain, and a
  `for_james` task (empty chain, no list rendered) have none.
- Unread: whenever the shown task has `unread: true`, the screen calls `markRead(task)` once
  for that change (a session message arriving while James reads clears again).
- States (criterion 29 for this screen): while the task or its comments load, an element
  with `role="status"` named `Loading thread`; on a read error, `Couldn't load this thread`
  and a `Retry` button that calls `retry()` on each failed source; a task that does not exist
  shows `This task no longer exists.` and a link `Back to threads` to `/`.
- Instrumentation: sending logs `user_action` with action `reply` and target the task id,
  and a failed send logs `api_call_failed` with the Firestore code, through the existing
  `track` helper (one `request_id` per send); quick replies log as on Threads.

- Fidelity round 1 decisions (B3): every send takes a fresh id from `newCommentId()` (when
  the id is generated is free, but two sends never share one), and the optimistic message is
  matched to the snapshot by id, never by text, so the same text sent twice shows twice. As in
  the prototype, a session message's label sits above its body and James's relative time and
  tick label sit below his body. A thread with no messages shows the quiet line
  `No messages yet.` above the composer. Only the task and comments reads gate the screen: a
  failed projects or agents read is logged by `data.ts` and degrades the header (no project
  name, no `session live`) without an error state or Retry.

Earlier contract blocks the thread view builds on (B2, verbatim from the spec):

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
- Rows: a task row's open control is a button whose accessible name starts with the title
  (so no row button's name starts with a project name, which the chip lookups rely on); tapping it
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

Instrumentation definitions (spec, Instrumentation section): `user_action` INFO with
`feature`, `action`, `target`; `api_call_failed` ERROR with `feature`, `target` = firestore,
`action`, `status`. `logging/taxonomy.json` entries:

```json
    "api_call_failed": {
      "severity_hint": "ERROR",
      "desc": "External call (API/DB/3rd party) failed",
      "required_context": ["target", "status"]
    },
-
    "user_action": {
      "severity_hint": "INFO",
      "desc": "Meaningful user interaction",
      "required_context": ["action"]
    },
```

## Execution harness (observed)

- `npm test` runs `vitest run` (`vitest.config.ts` below): files `tests/**/*.test.{ts,tsx}`,
  JSX via React's automatic runtime; a component test starts with
  `// @vitest-environment jsdom`.
- Installed: `@testing-library/react@16`, `@testing-library/user-event@14`,
  `@testing-library/dom@10`, `jsdom@26`, React 19, `react-router-dom@7`. No jest-dom
  matchers. `cleanup()` in `afterEach`.
- The B2 tests show the pattern in full: `vi.mock` of `packages/web/src/data.ts` (the
  Firestore boundary), `packages/web/src/firebase.ts`, `packages/web/src/lib/log.ts`, and a
  stand-in for `components/DecisionSheet.tsx`; `MemoryRouter` with a location probe; a
  Date-only fake clock. One B2 test file is quoted below as the worked example.
- `MemoryRouter initialEntries` accepts objects with `state`
  (`{ pathname: '/t/t1', state: { from: '/?project=p-site' } }`), which is how back
  navigation is observed.
- A pending write is a promise that never settles in the test; a rejected write is
  `Promise.reject(Object.assign(new Error('x'), { name: 'FirebaseError', code:
'permission-denied' }))`, matching how `track` reads Firestore errors (quoted below).
- Lint runs on tests at commit; the `no-unsafe-*` rules are off for `tests/**`.

## Output format

- Files: `tests/web-threads-b3-13.test.tsx`, `-14`, `-15`, `-2` (opened by id), `-28` (the
  reply half), `-29`, `-30` (thread view only), plus optionally
  `tests/fixtures/web-threads-b3.tsx`.
- Run `npx vitest run tests/web-threads-b3` and report the verbatim summary: every new test
  must FAIL because the behaviour is missing (a module that does not resolve yet, an export
  that is not a function), not because of a mistake in the test. Also run `npx vitest run`
  and confirm every existing test (B1, B2) still passes. If anything new passes, say which
  and why.
- Report: file list with line counts, the vitest tails, `npx eslint tests/`, and any
  contract detail you had to assume that this packet did not state.

## Observed baseline (source excerpts, commit

db6450f)

### vitest.config.ts

```tsx
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

```tsx
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

```tsx
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

```tsx
// Typed live queries over Firestore onSnapshot, plus the handful of writes the UI makes.
// Every write here is James acting from the UI: author is always 'james'.
import { useCallback, useEffect, useState } from 'react'
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
import { log } from './lib/log.ts'
import { newRequestId } from './lib/request-id.ts'

export interface Live<T> {
  data: T
  loading: boolean
  error: string | null
  // Re-subscribe after a failed read.
  retry: () => void
}

// A rejected read is logged here, once per rejection, so every screen gets it for free.
// Only the error code goes into the context: messages can quote document paths and ids.
function logReadFailed(source: string, err: { code?: string }) {
  log.error('api_call_failed', `Firestore read failed: ${source}`, {
    feature: 'web-threads',
    target: 'firestore',
    action: 'read',
    status: err.code ?? 'unknown',
    request_id: newRequestId(),
  })
}

// Each hook keeps `{ data, loading, error }` in state; `retry` bumps a counter that is part
// of the effect's dependencies, which tears the listener down and subscribes again.
type LiveState<T> = Omit<Live<T>, 'retry'>
function useRetry(): [number, () => void] {
  const [attempt, setAttempt] = useState(0)
  return [attempt, useCallback(() => setAttempt((n) => n + 1), [])]
}

// --- read hooks ---------------------------------------------------------------
// `deps` controls re-subscription; constraints are rebuilt only when deps change.

export function useCollection<T>(
  name: string,
  constraints: QueryConstraint[],
  deps: unknown[],
  enabled = true
): Live<T[]> {
  const [state, setState] = useState<LiveState<T[]>>({ data: [], loading: enabled, error: null })
  const [attempt, retry] = useRetry()
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
      (err) => {
        logReadFailed(name, err)
        setState({ data: [], loading: false, error: err.message })
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, enabled, attempt, ...deps])
  return { ...state, retry }
}

export function useDocument<T>(name: string, id: string | null | undefined): Live<T | null> {
  const [state, setState] = useState<LiveState<T | null>>({
    data: null,
    loading: !!id,
    error: null,
  })
  const [attempt, retry] = useRetry()
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
      (err) => {
        logReadFailed(name, err)
        setState({ data: null, loading: false, error: err.message })
      }
    )
  }, [name, id, attempt])
  return { ...state, retry }
}

// Projects, most recently touched first (single-field index).
export const useProjects = () =>
  useCollection<Project>(COLLECTIONS.projects, [orderBy('updatedAt', 'desc')], [])

// Every task, newest first (single-field index). Visibility and filters are client-side.
export const useAllTasks = () =>
  useCollection<Task>(COLLECTIONS.tasks, [orderBy('updatedAt', 'desc')], [])

// Every agent, for the live dot on a project (online = recent heartbeat).
export const useAgents = () => useCollection<AgentDoc>(COLLECTIONS.agents, [], [])

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

// The longest message body written from the UI (io-validation: capped before write).
const MAX_COMMENT_CHARS = 4000

// James's comment in the shape every writer uses; delivery stamps are the agent's to set.
function jamesComment(task: Task, kind: CommentKind, body: string, t: number, id: string): Comment {
  return {
    id,
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body: body.trim().slice(0, MAX_COMMENT_CHARS),
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

// A quick-reply answer: James's comment of kind `answer` carrying the option's label, and the
// need cleared. Only while the task is still waiting on a question, so a double tap is a no-op.
export async function answerQuestion(task: Task, option: { key: string; label: string }) {
  await transitionTask(task.id, (cur) =>
    cur.needs?.kind === 'question'
      ? { patch: { needs: null }, comment: { kind: 'answer', body: option.label } }
      : null
  )
}

// "Merged it": only from stage `pr`, so a second tap (or a stale row) writes nothing.
export async function markMerged(task: Task) {
  await transitionTask(task.id, (cur) =>
    cur.stage === 'pr'
      ? {
          patch: { stage: 'merged', needs: null },
          comment: { kind: 'merged', body: 'Merged it.' },
        }
      : null
  )
}

// Opening a thread clears its unread flag. updatedAt stays put so the row does not jump.
export async function markRead(task: Task) {
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), { unread: false })
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

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth.tsx'
import Home from './pages/Home.tsx'
import Threads from './pages/Threads.tsx'
import Board from './pages/Board.tsx'
import TaskPage from './pages/Task.tsx'

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Threads />} />
          {/* The Phase 1 project list, until the Projects screen (B5) replaces it. */}
          <Route path="/projects" element={<Home />} />
          <Route path="/p/:projectId" element={<Board />} />
          <Route path="/t/:taskId" element={<TaskPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  )
}
```

### packages/web/src/lib/threads.ts

```tsx
// Pure helpers behind the Threads home: which rows show, in what order, what each row says
// and which quick replies it offers. No React, no Firestore.
//
// Documents come straight from Firestore, so a half-migrated task must degrade to a visible
// "Unknown stage" row instead of crashing: every read of a field the model could lack goes
// through the guards at the top of this file.
import {
  DONE_VISIBLE_MS,
  STAGES,
  isDone,
  isTaskVisible,
  type NeedKind,
  type Task,
  type TaskNeed,
  type Todo,
} from '@kanban/shared'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const CLOCK_TEXT_CHARS = 5 // "HH:MM" from Date#toTimeString
const NEED_KINDS: readonly NeedKind[] = ['spec', 'question', 'pr', 'after_deploy']

// 'all', or a project id.
export type ProjectFilter = string

export type ThreadRow =
  | { kind: 'task'; task: Task; at: number; needs: boolean; unread: boolean }
  | {
      kind: 'for_james'
      projectId: string
      todos: Todo[]
      at: number
      needs: true
      unread: false
    }

// ---- shape guards -------------------------------------------------------------------

// The task's need when it is one this app knows how to show; anything else counts as none.
export function activeNeed(task: Pick<Task, 'needs'>): TaskNeed | null {
  const need: unknown = task.needs
  if (typeof need !== 'object' || need === null) return null
  const { kind } = need as { kind?: unknown }
  return NEED_KINDS.some((k) => k === kind) ? (need as TaskNeed) : null
}

function stepCount(task: Pick<Task, 'afterDeploy'>): number {
  return Array.isArray(task.afterDeploy) ? task.afterDeploy.length : 0
}

// Only web links may leave the app from a Firestore-supplied URL (never javascript:, data:).
function webUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

function visible(task: Task, now: number): boolean {
  return (
    task.type !== 'for_james' &&
    isTaskVisible({ stage: task.stage, doneAt: task.doneAt ?? null }, { now })
  )
}

const inProject = (projectId: string, filter: ProjectFilter | undefined) =>
  filter === undefined || filter === 'all' || projectId === filter

// ---- rows ---------------------------------------------------------------------------

function byPriority(a: ThreadRow, b: ThreadRow): number {
  return Number(b.needs) - Number(a.needs) || Number(b.unread) - Number(a.unread) || b.at - a.at
}

// Every visible task plus one For James row per project with open todos, needs-you first,
// then unread, then newest.
export function threadRows(input: {
  tasks: readonly Task[]
  todos: readonly Todo[]
  filter: ProjectFilter
  now?: number
}): ThreadRow[] {
  const { tasks, todos, filter, now = Date.now() } = input
  const rows: ThreadRow[] = tasks
    .filter((t) => visible(t, now) && inProject(t.projectId, filter))
    .map((task) => ({
      kind: 'task',
      task,
      at: task.updatedAt,
      needs: activeNeed(task) !== null,
      unread: task.unread === true,
    }))

  const open = new Map<string, Todo[]>()
  for (const todo of todos) {
    if (todo.done || !inProject(todo.projectId, filter)) continue
    open.set(todo.projectId, [...(open.get(todo.projectId) ?? []), todo])
  }
  for (const [projectId, list] of open) {
    const newestFirst = [...list].sort((a, b) => b.createdAt - a.createdAt)
    rows.push({
      kind: 'for_james',
      projectId,
      todos: newestFirst,
      at: newestFirst[0].createdAt,
      needs: true,
      unread: false,
    })
  }
  return rows.sort(byPriority)
}

// Visible tasks with a need plus open todos, for one project or (absent / 'all') for all.
export function needsCount(input: {
  tasks: readonly Task[]
  todos: readonly Todo[]
  projectId?: ProjectFilter
  now?: number
}): number {
  const { tasks, todos, projectId, now = Date.now() } = input
  const needing = tasks.filter(
    (t) => visible(t, now) && inProject(t.projectId, projectId) && activeNeed(t) !== null
  )
  const open = todos.filter((t) => !t.done && inProject(t.projectId, projectId))
  return needing.length + open.length
}

// ---- words --------------------------------------------------------------------------

const NEED_TEXT: Record<NeedKind, string> = {
  spec: 'Spec · needs you',
  question: 'Question for you',
  pr: 'PR ready · needs you',
  after_deploy: 'After deploy · needs you',
}
const STAGE_TEXT: Record<string, string> = {
  spec: 'Writing spec',
  approved: 'Approved',
  build: 'Building',
  fix: 'Fixing',
  do: 'Doing',
  pr: 'PR open',
  merged: 'Merged',
  main_ci: 'Waiting for CI on main',
  after_deploy: 'After deploy',
}
export const UNKNOWN_STAGE_TEXT = 'Unknown stage'

export function stageText(task: Task): string {
  if (isDone(task)) return 'Done'
  const need = activeNeed(task)
  if (need) return NEED_TEXT[need.kind]
  return (STAGES.includes(task.stage) && STAGE_TEXT[task.stage]) || UNKNOWN_STAGE_TEXT
}

// "now", "12 min", the clock time earlier today, "Yesterday", "3 d".
export function relativeTime(at: number, now: number): string {
  const age = now - at
  if (age < MINUTE_MS) return 'now'
  if (age < HOUR_MS) return `${Math.round(age / MINUTE_MS)} min`
  if (age < DAY_MS) return new Date(at).toTimeString().slice(0, CLOCK_TEXT_CHARS)
  const days = Math.floor(age / DAY_MS)
  return days === 1 ? 'Yesterday' : `${days} d`
}

// "1 thing to do by hand", "3 things to do by hand".
export const forJamesSummary = (count: number): string =>
  `${count} ${count === 1 ? 'thing' : 'things'} to do by hand`

// Days left before a done task leaves the lists, for the "gone in N d" hint (never below 1).
export function daysUntilHidden(task: Pick<Task, 'doneAt'>, now: number): number | null {
  if (task.doneAt == null) return null
  return Math.max(1, Math.ceil((DONE_VISIBLE_MS - (now - task.doneAt)) / DAY_MS))
}

// ---- quick replies ------------------------------------------------------------------

export type QuickReply =
  | { kind: 'approve'; label: string }
  | { kind: 'change'; label: string }
  | { kind: 'answer'; label: string; option: { key: string; label: string } }
  | { kind: 'pr_link'; label: string; href: string }
  | { kind: 'merged'; label: string }
  | { kind: 'read'; label: string }

function questionOptions(need: TaskNeed): { key: string; label: string }[] {
  if (!Array.isArray(need.options)) return []
  return need.options.filter(
    (o) => o && typeof o.key === 'string' && typeof o.label === 'string' && o.label.trim() !== ''
  )
}

const READ_MORE: QuickReply = { kind: 'read', label: 'Read more' }

function prReplies(task: Task): QuickReply[] {
  const href = webUrl(task.pr?.url)
  const link: QuickReply[] =
    href && task.pr ? [{ kind: 'pr_link', label: `Open PR #${task.pr.number}`, href }] : []
  return [...link, { kind: 'merged', label: 'Merged it' }, READ_MORE]
}

// The chips under a row that needs James, by the kind of need; none for a quiet row.
export function quickReplies(task: Task): QuickReply[] {
  const need = activeNeed(task)
  if (!need) return []
  switch (need.kind) {
    case 'spec':
      return [
        { kind: 'approve', label: 'Approve spec' },
        { kind: 'change', label: 'Small change…' },
        READ_MORE,
      ]
    case 'question':
      return [
        ...questionOptions(need).map((option): QuickReply => ({
          kind: 'answer',
          label: `${option.key} · ${option.label}`,
          option: { key: option.key, label: option.label },
        })),
        READ_MORE,
      ]
    case 'pr':
      return prReplies(task)
    case 'after_deploy': {
      const steps = stepCount(task)
      return [{ kind: 'read', label: `Open the ${steps} ${steps === 1 ? 'step' : 'steps'}` }]
    }
  }
}
```

### packages/web/src/lib/use-thread-actions.ts

```tsx
// What a tap on Threads does: log it (with one request id per operation), run the write,
// navigate, or open the decision sheet. The sheet state itself stays with the screen.
import { useNavigate } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { answerQuestion, approveSpec, markMerged, markRead } from '../data.ts'
import { log } from './log.ts'
import { newRequestId } from './request-id.ts'
import type { QuickReply } from './threads.ts'

export const FEATURE = 'web-threads'

export type SheetMode = 'read' | 'change'

// Records a tap, then runs the write; a failed write is logged with the same request id so
// the tap can be followed to its failure: a Firestore error is api_call_failed with its code,
// anything else is feature_error. The row stays as it was (the snapshot is the truth).
export async function track(action: string, target: string, write?: () => Promise<unknown>) {
  const requestId = newRequestId()
  log.event('user_action', { feature: FEATURE, action, target, request_id: requestId })
  if (!write) return
  try {
    await write()
  } catch (err) {
    const context = { feature: FEATURE, action, request_id: requestId }
    const code = firestoreCode(err)
    if (code !== null)
      log.error('api_call_failed', `Firestore write failed: ${action}`, {
        ...context,
        target: 'firestore',
        status: code,
      })
    else log.error('feature_error', `${action} failed`, context)
  }
}

// The Firestore error code ('permission-denied', 'unavailable', ...) when `err` is a
// FirebaseError, else null.
function firestoreCode(err: unknown): string | null {
  if (!(err instanceof Error) || err.name !== 'FirebaseError') return null
  return 'code' in err && typeof err.code === 'string' ? err.code : 'unknown'
}

export function useThreadActions(openSheet: (task: Task, mode: SheetMode) => void) {
  const navigate = useNavigate()

  return {
    openThread: (task: Task) => {
      void track('open_thread', task.id, task.unread ? () => markRead(task) : undefined)
      void navigate(`/t/${task.id}`)
    },
    openForJames: (projectId: string) => {
      void navigate(`/p/${projectId}?tab=james`)
    },
    reply: (task: Task, quick: QuickReply) => {
      switch (quick.kind) {
        case 'approve':
          void track('approve_spec', task.id, () => approveSpec(task))
          break
        case 'answer':
          void track('answer', task.id, () => answerQuestion(task, quick.option))
          break
        case 'merged':
          void track('merged', task.id, () => markMerged(task))
          break
        case 'change':
          openSheet(task, 'change')
          break
        case 'read':
          openSheet(task, 'read')
          break
        case 'pr_link':
          break // a real link: the browser opens it
      }
    },
  }
}
```

### packages/web/src/components/QuickReplies.tsx

```tsx
import type { QuickReply } from '../lib/threads.ts'
import { Button } from './ui/button.tsx'
import { ExternalLink } from '../lib/icons.ts'

// The chips under a row that needs James. The first one is the primary action (ink); the
// rest are outlined. A PR link opens in a new tab, everything else is a button.
export default function QuickReplies({
  replies,
  onReply,
}: {
  replies: QuickReply[]
  onReply: (reply: QuickReply) => void
}) {
  if (replies.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pt-1.5 pl-15">
      {replies.map((reply, index) => {
        const variant = index === 0 ? 'primary' : 'outline'
        const pill = 'rounded-full px-4 text-sm'
        if (reply.kind === 'pr_link')
          return (
            <Button key={reply.label} asChild variant={variant} className={pill}>
              <a href={reply.href} target="_blank" rel="noopener noreferrer">
                {reply.label}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          )
        return (
          <Button
            key={reply.label}
            variant={variant}
            className={pill}
            onClick={() => onReply(reply)}
          >
            {reply.label}
          </Button>
        )
      })}
    </div>
  )
}
```

### packages/web/src/components/DecisionSheet.tsx

```tsx
import type { Task } from '@kanban/shared'
import { activeNeed } from '../lib/threads.ts'
import { Sheet, SheetContent } from './ui/sheet.tsx'

// What the sheet says under the title, from the need it was opened for.
function summaryLine(task: Task): string {
  const need = activeNeed(task)
  if (need?.kind === 'question' && need.question) return need.question
  if (need?.kind === 'spec' && task.spec?.goal) return task.spec.goal
  if (typeof task.summary === 'string' && task.summary) return task.summary
  return 'Nothing more to read on this one yet.'
}

// The decision card that slides up from "Read more" and "Open the N steps". B2 only needs it
// to open and close accessibly; the decisions themselves (approve, change request, answer,
// merged, ticks) arrive with B4. Radix handles focus trap, Escape and focus return; the close
// button comes with the sheet primitive.
export default function DecisionSheet({
  task,
  mode,
  onClose,
}: {
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent title={task.title} description={summaryLine(task)} data-mode={mode} />
    </Sheet>
  )
}
```

### tests/fixtures/web-threads-b2.tsx

```tsx
// Shared fixture for the web-threads B2 suites: builders over the real shared task model, the
// mocked Firestore boundary (data.ts hooks + action spies), the logger spy, a DecisionSheet
// stand-in that shows what opened, and a router that prints where the app navigated to.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(FIXTURE)).dataModule())
import type { ReactNode } from 'react'
import { afterEach, beforeEach, vi, type Mock } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  initialTaskFields,
  type AgentDoc,
  type Project,
  type Task,
  type Todo,
} from '../../packages/shared/src/index.ts'

export const NOW = Date.UTC(2026, 10, 3, 12, 0, 0)
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const project = (id: string, name: string): Project => ({
  id,
  hostname: 'pc',
  cwd: `C:/code/${name}`,
  name,
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
})
export const PROJECTS: Project[] = [
  project('p-kanban', 'kanban'),
  project('p-site', 'website'),
  project('p-cal', 'calendar'),
]

// A complete task from the shared initial shape; overrides win.
export function makeTask(id: string, over: Partial<Task> = {}): Task {
  const base = initialTaskFields({
    projectId: over.projectId ?? 'p-kanban',
    type: over.type ?? 'feature',
    title: over.title ?? `Task ${id}`,
    description: '',
    createdBy: 'james',
    afterDeploy: over.afterDeploy ?? [],
    now: NOW - DAY,
  })
  return { ...base, id, ...over }
}

export function makeTodo(id: string, over: Partial<Todo> = {}): Todo {
  return {
    id,
    projectId: 'p-kanban',
    body: `Todo ${id}`,
    link: null,
    done: false,
    sourceTaskId: null,
    createdAt: NOW - HOUR,
    doneAt: null,
    ...over,
  }
}

// ---- mocked data.ts ---------------------------------------------------------------

export interface LiveStub<T> {
  data: T
  loading: boolean
  error: string | null
  retry: Mock<() => void>
}
export function live<T>(data: T, over: Partial<LiveStub<T>> = {}): LiveStub<T> {
  return { data, loading: false, error: null, retry: vi.fn<() => void>(), ...over }
}

export const board = {
  tasks: live<Task[]>([]),
  todos: live<Todo[]>([]),
  projects: live<Project[]>(PROJECTS),
  agents: live<AgentDoc[]>([]),
}

export const actions = {
  approveSpec: vi.fn((_task: Task) => Promise.resolve()),
  answerQuestion: vi.fn((_task: Task, _option: { key: string; label: string }) =>
    Promise.resolve()
  ),
  markMerged: vi.fn((_task: Task) => Promise.resolve()),
  markRead: vi.fn((_task: Task) => Promise.resolve()),
}

export const logSpy = {
  event: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  critical: vi.fn(),
}

// Replaces the board (loaded, no errors) and clears every spy.
export function setBoard(next: { tasks?: Task[]; todos?: Todo[]; projects?: Project[] } = {}) {
  board.tasks = live(next.tasks ?? [])
  board.todos = live(next.todos ?? [])
  board.projects = live(next.projects ?? PROJECTS)
  board.agents = live<AgentDoc[]>([])
  vi.clearAllMocks()
}

export const dataModule = () => ({
  useAllTasks: () => board.tasks,
  useOpenTodos: () => board.todos,
  useProjects: () => board.projects,
  useAgents: () => board.agents,
  ...actions,
})
export const logModule = () => ({ log: logSpy })

export function DecisionSheetStandIn(props: {
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}) {
  return (
    <div role="dialog" aria-label="Decision sheet">
      <p>{`sheet ${props.mode}: ${props.task.title}`}</p>
      <button type="button" onClick={props.onClose}>
        Close sheet
      </button>
    </div>
  )
}
export const sheetModule = () => ({ default: DecisionSheetStandIn })

// ---- rendering --------------------------------------------------------------------

// Fakes only the clock (components read Date.now()) and unmounts after each test.
export function installClock() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })
}

function WhereAmI() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

// Mounts `home` on `/`; every other path renders a placeholder. The probe prints the URL.
export function renderAt(path: string, home: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={home} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <WhereAmI />
    </MemoryRouter>
  )
}

export const where = () => screen.getByTestId('location').textContent
export const pageText = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')
export const named = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

// A task row's open control: the button whose name contains the title.
export const openButton = (title: string) => screen.getByRole('button', { name: named(title) })
export const queryOpenButton = (title: string) =>
  screen.queryByRole('button', { name: named(title) })

// The row around a control: its list item (or article), else the control's parent.
export function rowOf(control: HTMLElement): HTMLElement {
  return (
    control.closest<HTMLElement>('li, [role="listitem"], article') ??
    control.parentElement ??
    control
  )
}
export const rowText = (control: HTMLElement) =>
  (rowOf(control).textContent ?? '').replace(/\s+/g, ' ')

// Filter chips are the buttons that expose aria-pressed.
export const chips = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
export function chip(name: string): HTMLElement {
  const found = chips().find((b) => (b.textContent ?? '').trim().startsWith(name))
  if (!found) throw new Error(`no filter chip starting with "${name}"`)
  return found
}

export const isBefore = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
```

### tests/web-threads-b2-11.test.tsx

```tsx
// @vitest-environment jsdom
// web-threads B2, criterion 11: tapping a row's title opens the thread and clears unread;
// tapping a quick reply dispatches its action (or opens the decision sheet) and stays on Threads.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  actions,
  installClock,
  logSpy,
  makeTask,
  openButton,
  renderAt,
  setBoard,
  where,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const spec = makeTask('t-spec', { title: 'Spec the search', needs: { kind: 'spec' } })
const question = makeTask('t-question', {
  projectId: 'p-site',
  title: 'Pick a font',
  stage: 'build',
  unread: true,
  needs: {
    kind: 'question',
    question: 'Which font?',
    options: [
      { key: 'A', label: 'Inter' },
      { key: 'B', label: 'Atkinson' },
    ],
  },
})
const pr = makeTask('t-pr', {
  projectId: 'p-site',
  title: 'Ship the footer',
  stage: 'pr',
  needs: { kind: 'pr' },
  pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
})
const steps = makeTask('t-steps', {
  title: 'Check the deploy',
  stage: 'after_deploy',
  afterDeploy: ['Open the site', 'Sign in'],
  needs: { kind: 'after_deploy' },
})
const quiet = makeTask('t-quiet', { title: 'Build the cache', stage: 'build' })

const start = () => {
  setBoard({ tasks: [spec, question, pr, steps, quiet] })
  renderAt('/', <Threads />)
  return userEvent.setup()
}
const loggedAction = (action: string, target: string) =>
  expect(logSpy.event).toHaveBeenCalledWith(
    'user_action',
    expect.objectContaining({ feature: 'web-threads', action, target })
  )
const stillOnThreads = () => {
  expect(where()).toBe('/')
  expect(screen.getByRole('heading', { name: /^Threads/ })).toBeTruthy()
}

describe('B2-11 opening a thread', () => {
  installClock()

  it('tapping an unread row opens /t/:id, clears unread and logs open_thread', async () => {
    const user = start()
    await user.click(openButton('Pick a font'))
    expect(where()).toBe('/t/t-question')
    expect(actions.markRead).toHaveBeenCalledTimes(1)
    expect(actions.markRead).toHaveBeenCalledWith(expect.objectContaining({ id: 't-question' }))
    loggedAction('open_thread', 't-question')
  })

  it('tapping a read row opens the thread without marking it read', async () => {
    const user = start()
    await user.click(openButton('Build the cache'))
    expect(where()).toBe('/t/t-quiet')
    expect(actions.markRead).not.toHaveBeenCalled()
  })
})

describe('B2-11 quick replies act without leaving Threads', () => {
  installClock()

  it('Approve spec approves that task and logs approve_spec', async () => {
    const user = start()
    await user.click(screen.getByRole('button', { name: 'Approve spec' }))
    expect(actions.approveSpec).toHaveBeenCalledTimes(1)
    expect(actions.approveSpec).toHaveBeenCalledWith(expect.objectContaining({ id: 't-spec' }))
    loggedAction('approve_spec', 't-spec')
    stillOnThreads()
  })

  it('an option chip answers the question with that option and logs answer', async () => {
    const user = start()
    await user.click(screen.getByRole('button', { name: 'B · Atkinson' }))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(actions.answerQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't-question' }),
      { key: 'B', label: 'Atkinson' }
    )
    loggedAction('answer', 't-question')
    expect(actions.markRead).not.toHaveBeenCalled()
    stillOnThreads()
  })

  it('Merged it marks the PR merged and logs merged', async () => {
    const user = start()
    await user.click(screen.getByRole('button', { name: 'Merged it' }))
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
    expect(actions.markMerged).toHaveBeenCalledWith(expect.objectContaining({ id: 't-pr' }))
    loggedAction('merged', 't-pr')
    stillOnThreads()
  })

  it.each([
    ['Read more', 'read', pr],
    ['Small change…', 'change', spec],
    ['Open the 2 steps', 'read', steps],
  ] as const)('%s opens the decision sheet in mode %s for its task', async (name, mode, task) => {
    setBoard({ tasks: [task, quiet] })
    renderAt('/', <Threads />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name }))
    const sheet = screen.getByRole('dialog', { name: 'Decision sheet' })
    expect(sheet.textContent).toContain(`sheet ${mode}: ${task.title}`)
    stillOnThreads()
    await user.click(screen.getByRole('button', { name: 'Close sheet' }))
    expect(screen.queryByRole('dialog', { name: 'Decision sheet' })).toBeNull()
  })
})
```

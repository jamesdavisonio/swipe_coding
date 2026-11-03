# Test-author packet — web-threads B4 (Decision sheet)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot: commit
863d03e on branch feat/web-threads-b4 (clean tree). B1 (shared model), B2 (Threads home) and B3
(thread view) are merged; their code is real and quoted below where B4 builds on it.

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

Repository notes on those rules: this repo is TypeScript; there is no D1 helper. Two observed
harnesses exist, both quoted below:

- Component tests: vitest + Testing Library + jsdom, `tests/*.test.tsx`, fixtures
  `tests/fixtures/web-threads-b2.tsx` and `tests/fixtures/web-threads-b3.tsx`. Reuse them by
  importing; put anything new for B4 in one new module `tests/fixtures/web-threads-b4.tsx`.
- Emulator tests (`npm run test:rules`, `vitest.rules.config.ts`): `tests/emulator/*.test.ts`
  run the real `packages/web/src/data.ts` against the Firestore emulator as James, with
  `firebase.ts` and `lib/log.ts` mocked (pattern below), and read the documents back. The
  emulator is real I/O; this is how B4 tests what its writes store, not a mock. Shared setup
  for them goes in one new module `tests/fixtures/web-threads-b4-emulator.ts`.
  Do not edit any existing test or fixture file.

## Assigned criteria (from docs/features/web-threads.md, verbatim)

### B4 — Decision sheet

16. Given a task needing a spec decision, when Read more opens, the sheet shows the spec
    (goal, points, out of scope, touches, version) and offers Approve and Request a
    change (free text, required); Approve records "Approved spec vN" in the history,
    clears the need, moves the stage to `build`, sends "Approved." as James's message; a
    change request records the text, clears the need and sends "Change: <text>".
17. Given a task needing an answer, when Read more opens, the sheet shows the full
    question and its options plus a free-text field; choosing or typing sends the answer
    (kind `answer`), records "Answered <q>: <a>" and clears the need.
18. Given a task needing a PR decision, when Read more opens, the sheet shows the
    session's summary, an Open PR link (new tab) and Merged it; Merged it records
    "Merged PR #n", moves the stage to `merged`, sends "Merged it." and clears the need.
19. Given a task needing after-deploy work, when the sheet opens, each step is a 44 px
    checkbox row; ticking records "Step done: <step>" (unticking records "Step unticked");
    when all steps are ticked the task moves to `done` with `doneAt` now, sends
    "After-deploy steps done." and records "Done".
20. Given any decision sheet, when it is open, focus is trapped, Escape and the close
    button dismiss it without side effects, and the trigger regains focus.

Shared criteria that apply to the decision sheet:

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

For criterion 28, B4 owns the tick half (the reply half is B3's and shipped). For 29, the
sheet's write-failure state is the one that applies (it reads no extra data). Criterion 30 in
jsdom: keyboard reachability, accessible names and focus behaviour are observable; whether the
focus ring is visible is CSS, checked at review.

Also assigned (carried over by the earlier contracts): emulator tests of the writes B2 and B3
shipped without them, `sendReply` (criterion 14's answer/comment write) and `markRead`
(criterion 11's unread clear).

Not assigned to B4: Projects and New task (B5), the History sheet's contents and Reopen
(B6), anything the session does.

## Selected new contract (planner decisions, recorded in the spec; exact names tests may assert)

**B4 contract details fixed at test time** (planner decisions, 2026-11-03):

- Writes (`packages/web/src/data.ts`), each tested in the Firestore emulator as James
  (`tests/emulator/`, `npm run test:rules`), reading back the task, its comments and its
  `log` / `tasks/{id}/log_archive`. Except for `tickStep`, each write is a transaction guarded
  on the task's current state, so a double tap or a stale screen writes nothing; history
  entries go through `appendLog` with `who: 'james'`, and any overflow past `LOG_CAP` is moved
  to `tasks/{id}/log_archive` in the same transaction. James's messages are comments with
  `author: 'james'` built by the shared `jamesComment`:
  - `approveSpec(task)`: only while the need is `spec` and the stage is `spec` or `approved`.
    Stage `build`, need `null`, history `Approved spec v<N>` (N = `spec.version`, 1 when there
    is no spec), message kind `approve` with body `Approved.`.
  - `requestChange(task, text)`: only while the need is `spec`; `text` is trimmed, must be
    non-empty (otherwise nothing is written) and is capped at 4000 characters. Need `null`,
    stage unchanged, history `Asked for a change to spec v<N>: <text>`, message kind
    `change_request` with body `Change: <text>`.
  - `answerQuestion(task, answer: { key?: string; label: string })`: only while the need is
    `question`, and, when `key` is given, only while that key is still one of
    `needs.options` (a stale option writes nothing). Free text passes `{ label: text }`,
    trimmed, non-empty, capped. Need `null`, history `Answered <question>: <label>` (or
    `Answered: <label>` when the need has no question text), message kind `answer` with body
    `<label>`.
  - `markMerged(task)`: only at stage `pr`. Stage `merged`, need `null`, history
    `Merged PR #<n>` (or `Merged the PR` when `pr` is null), message kind `merged` with body
    `Merged it.`.
  - `tickStep(task, index)`: a batch, not a transaction, so a tick made offline is queued
    (criterion 28). Only while the stage is `after_deploy` and `index` is a step; otherwise
    nothing is written. It flips `afterDone[index]` (from the task as the screen has it) and
    appends history `Step done: <step>` or `Step unticked: <step>` with `arrayUnion` (the cap is
    enforced by the next transactional writer). When the tick makes every step done, the same
    batch also sets stage `done`, `doneAt` now, need `null`, `working: false`, adds the
    history `Done` (`who: 'system'`) and James's message kind `comment` with body
    `After-deploy steps done.`.
  - `sendReply`, `markRead` (B2/B3) get their emulator tests here too: what each writes, and
    that the rules accept it.
- Decision sheet (`packages/web/src/components/DecisionSheet.tsx`, same props
  `{ task, mode, onClose }`; it renders for the task's current need and closes itself, by
  calling `onClose`, when the task no longer has the need it opened for). A dialog named by
  its title:
  - spec: title `Spec v<N> — <task title>`; shows the goal, each point, `Out of scope` with
    `spec.out`, `Touches` with `spec.touches` (when the spec is null: `The session hasn't
attached the spec yet.`). Buttons `Approve v<N>` and `Changes…`; in mode `change` (or after
    `Changes…`) a textarea labelled `What should change?`, a button `Send to session` disabled
    while the trimmed text is empty, and `Cancel` back to the spec.
  - question: title the question (`Question` when it has none); one button per option labelled
    `<key> · <label>`; a textarea labelled `Or answer in your words` and a button
    `Send answer` disabled while the trimmed text is empty.
  - pr: title `PR #<n> is ready to merge` (`PR is ready to merge` without a PR); the task's
    summary; a link `Open PR #<n> in GitHub` (`target="_blank"`, `rel` containing `noopener`,
    http/https only) and a button `Merged it`.
  - after_deploy: title `Deployed. Your steps:`; one checkbox per step, labelled by the step's
    text, checked from `afterDone`, in a row at least 44 px tall; the note
    `The task closes itself when every step is ticked.`
  - Every sheet has a `Close` button. Escape or Close dismisses it without calling any write;
    focus returns to the control that opened it (criterion 20).
- Outcomes: approve, send change, answer (option or free text) and merged call the write
  once and close the sheet when it resolves; if it rejects, the sheet stays open with an
  inline `role="alert"` `Couldn't save. Try again.` and the typed text kept. A tick shows the
  new checkbox state at once (before the snapshot) and keeps it while the write is pending;
  if it rejects, the checkbox reverts and the same alert shows. Buttons are disabled while
  their write is pending, so one tap writes once.
- Instrumentation, through the existing `track` helper (one `request_id` per tap):
  `user_action` with action `approve_spec`, `request_change`, `answer`, `merged`, `tick_step`
  or `untick_step` and target the task id; a failed write logs `api_call_failed` with the
  Firestore code; when a tick resolves and completed the steps, `milestone_reached` with
  `milestone: 'task_done'` and target the task id. Quick replies on Threads and the thread
  keep calling `approveSpec`, `answerQuestion` and `markMerged`, now with the B4 effects.

- Fidelity round 1 decisions (B4): `milestone_reached` is logged with
  `log.event('milestone_reached', { feature, milestone: 'task_done', target })`, only after the
  completing tick's write resolves, never while it is pending or after it fails. The step
  checkboxes are controlled by the task's `afterDone`, so a later snapshot (a tick from
  another device) updates any step without a pending tick of its own.

Earlier contract blocks B4 builds on (B2 and B3, verbatim from the spec):

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

Instrumentation definitions (spec): `user_action` INFO (`feature`, `action`, `target`);
`milestone_reached` INFO (`feature`, `milestone`, `target`); `api_call_failed` ERROR
(`feature`, `target` = firestore, `action`, `status`). `logging/taxonomy.json` entries:

```json
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
"api_call_failed": {
      "severity_hint": "ERROR",
      "desc": "External call (API/DB/3rd party) failed",
      "required_context": ["target", "status"]
    }
```

## Execution harness (observed)

- `npm test` runs jsdom/unit tests (`vitest.config.ts`, excludes `tests/rules/**` and
  `tests/emulator/**`). `npm run test:rules` runs `vitest.rules.config.ts` inside the Firestore
  emulator (`firebase emulators:exec`; on this machine prefix
  `PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH"`), covering `tests/rules/**` and
  `tests/emulator/**`.
- Emulator pattern for the data layer (proved on this snapshot: transactions and batches from
  `data.ts` run against the emulator under the real rules):

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('../../packages/web/src/firebase.ts', () => ({
  app: {},
  auth: {},
  get db() {
    return h.db
  },
}))
vi.mock('../../packages/web/src/lib/log.ts', () => ({
  log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kanban',
    firestore: {
      rules: readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
  h.db = env
    .authenticatedContext('james-uid', { email: 'j@nullnoise.ai', email_verified: true })
    .firestore() as unknown as Firestore
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())
// then: const data = await import('../../packages/web/src/data.ts'); seed with setDoc; call
// data.<write>(task, ...); read back with getDoc / getDocs(collection(...)).
```

Seed with `env.withSecurityRulesDisabled` or as James (the rules allow James's writes); the
`id` field is not stored on the task document (`data.ts` adds it from the snapshot).

- Component tests: the B2/B3 pattern (quoted below): `vi.mock` of `data.ts`, `firebase.ts`,
  `lib/log.ts`; `MemoryRouter`; Date-only fake clock. For B4 the sheet is the real
  `DecisionSheet` (do not mock it) inside Threads or the thread view, or rendered directly with
  `{ task, mode, onClose }`. Radix renders the dialog in a portal under `document.body`;
  `screen` queries reach it. A pending write is a promise that never settles; a refused write
  is `Promise.reject(Object.assign(new Error('x'), { name: 'FirebaseError', code:
'permission-denied' }))`.
- Lint runs on tests at commit; the `no-unsafe-*` rules are off for `tests/**`.

## Output format

- Component files: `tests/web-threads-b4-16.test.tsx` … `-20`, `tests/web-threads-b4-28.test.tsx`
  (tick half), `-30` (sheet keyboard/names), plus optionally `tests/fixtures/web-threads-b4.tsx`.
- Emulator files: `tests/emulator/web-threads-b4-16.test.ts` … `-19` (what each decision
  write stores, its guard, and the history overflow to `log_archive`), `-28` (`tickStep`'s
  batch), `-14` (`sendReply`), `-11` (`markRead`), plus optionally
  `tests/fixtures/web-threads-b4-emulator.ts`.
- Run `npx vitest run tests/web-threads-b4` and
  `PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules`, and report the
  verbatim summaries. Every new test must FAIL because the behaviour is missing (a missing
  export such as `requestChange`/`tickStep`, the sheet lacking its controls, a write storing
  the B2/B3 bodies), not because of a mistake in the test. Emulator tests of behaviour that
  already exists unchanged (`sendReply`, `markRead`, parts of `markMerged`) may pass at red:
  list exactly which pass and why. Also run `npx vitest run` and confirm the B1–B3 tests still
  pass.
- Report: file list with line counts, the tails, `npx eslint tests/`, and any contract detail
  you had to assume.

## Observed baseline (source excerpts, commit 863d03e)

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
    exclude: ['tests/rules/**', 'tests/emulator/**', '**/node_modules/**'],
  },
})
```

### vitest.rules.config.ts

```tsx
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

### firestore.rules

```tsx
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

    // The browser writes only the kinds James sends; session kinds are the agent's.
    function isJamesKind() {
      return request.resource.data.kind in ['comment', 'answer', 'approve', 'change_request', 'merged', 'reopen'];
    }

    match /projects/{id}  { allow read, write: if isOwner(); }
    match /agents/{id}    { allow read: if isOwner(); allow write: if false; }
    match /tasks/{id} {
      allow read, write: if isOwner();
      // Overflow of the task's decision log (appendLog moves the oldest entries here).
      match /log_archive/{entry} { allow read, write: if isOwner(); }
    }
    match /todos/{id}     { allow read, write: if isOwner(); }

    match /comments/{id} {
      allow read: if isOwner();
      allow create: if isOwner() && authoredByJames() && isJamesKind();
      // Edits of own comments only; agent comments are immutable from the UI, and a sent
      // comment keeps its author and kind (no rewriting a James comment into a session kind).
      allow update: if isOwner() && resource.data.author == 'james' && authoredByJames()
        && request.resource.data.kind == resource.data.kind;
      allow delete: if isOwner() && resource.data.author == 'james' && authoredByJames();
    }

    // Default deny: anything not matched above (scripts/check-firestore-rules.mjs insists).
    match /{document=**} {
      allow read, write: if false;
    }
  }
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
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  COLLECTIONS,
  forJamesTaskId,
  initialTaskFields,
  type AgentDoc,
  type Comment,
  type CommentKind,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { db } from './firebase.ts'
import { log } from './lib/log.ts'
import { jamesComment, replyKind } from './lib/messages.ts'
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

// A fresh comment id, generated on the device before anything is written, so the screen can show
// the message at once and a retried write lands on the same document instead of a duplicate.
export const newCommentId = (): string => doc(collection(db, COLLECTIONS.comments)).id

// James's reply from the composer. The comment is written under `id`, trimmed and capped. When
// the task is waiting on a question the comment is the answer (kind `answer`) and the need is
// cleared in the same write; otherwise it is a plain `comment` and the need stays. A batch, not
// a transaction: a transaction cannot run offline, a batch is queued and committed on return.
export async function sendReply(task: Task, reply: { id: string; body: string }) {
  const kind = replyKind(task)
  const t = now()
  const batch = writeBatch(db)
  batch.set(
    doc(db, COLLECTIONS.comments, reply.id),
    jamesComment(task, kind, reply.body, t, reply.id)
  )
  batch.update(doc(db, COLLECTIONS.tasks, task.id), {
    lastCommentAt: t,
    updatedAt: t,
    ...(kind === 'answer' ? { needs: null } : {}),
  })
  await batch.commit()
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

### packages/web/src/lib/messages.ts

```tsx
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
```

### packages/web/src/lib/use-thread-actions.ts

```tsx
// What a tap on Threads does: log it (with one request id per operation), run the write,
// navigate, or open the decision sheet. The sheet state itself stays with the screen.
import { useLocation, useNavigate } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { answerQuestion, approveSpec, markMerged, markRead } from '../data.ts'
import { log } from './log.ts'
import { newRequestId } from './request-id.ts'
import type { QuickReply } from './threads.ts'

export const FEATURE = 'web-threads'

export type SheetMode = 'read' | 'change'

// Logs a failed write under the request id of the tap that caused it: a Firestore error is
// api_call_failed with its code, anything else is feature_error.
export function reportFailure(action: string, requestId: string, err: unknown) {
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

// Records a tap, then runs the write. A failed write is logged with the same request id so the
// tap can be followed to its failure, and the result says whether it went through (true when
// there was no write): the row stays as it was (the snapshot is the truth), while the thread's
// composer uses the result to take its optimistic message back.
export async function track(
  action: string,
  target: string,
  write?: () => Promise<unknown>
): Promise<boolean> {
  const requestId = newRequestId()
  log.event('user_action', { feature: FEATURE, action, target, request_id: requestId })
  if (!write) return true
  try {
    await write()
    return true
  } catch (err) {
    reportFailure(action, requestId, err)
    return false
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
  const location = useLocation()

  return {
    // The thread's Back button returns to where James came from, project filter included.
    openThread: (task: Task) => {
      void track('open_thread', task.id, task.unread ? () => markRead(task) : undefined)
      void navigate(`/t/${task.id}`, { state: { from: location.pathname + location.search } })
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

// A usable timestamp: a number a Date can represent. A document without one still renders, just
// without a time (toISOString would throw and take the whole screen down).
export const isDateable = (at: unknown): at is number =>
  typeof at === 'number' && Number.isFinite(at) && !Number.isNaN(new Date(at).getTime())

// "now", "12 min", the clock time earlier today, "Yesterday", "3 d".
export function relativeTime(at: number, now: number): string {
  const age = now - at
  if (age < MINUTE_MS) return 'now'
  if (age < HOUR_MS) return `${Math.round(age / MINUTE_MS)} min`
  if (age < DAY_MS) return new Date(at).toTimeString().slice(0, CLOCK_TEXT_CHARS)
  const days = Math.floor(age / DAY_MS)
  return days === 1 ? 'Yesterday' : `${days} d`
}

// "Today 14:05", "Yesterday 09:30", "24 Oct 18:00".
export function dayAndTime(at: number, now: number): string {
  const day = new Date(at)
  const time = day.toTimeString().slice(0, CLOCK_TEXT_CHARS)
  if (day.toDateString() === new Date(now).toDateString()) return `Today ${time}`
  if (day.toDateString() === new Date(now - DAY_MS).toDateString()) return `Yesterday ${time}`
  return `${day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`
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

### packages/web/src/components/ui/sheet.tsx

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { X } from '../../lib/icons.ts'

// The bottom sheet from the prototype ("Read more" → decision card, reopen note, new task).
// Radix Dialog underneath: focus trap, focus restore, Escape, aria-modal, scroll lock.
// Every sheet has a title (announced on open); description is optional.

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export interface SheetContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  title: ReactNode
  description?: ReactNode
  // Label for the close button; defaults to "Close".
  closeLabel?: string
}

export function SheetContent({
  className,
  children,
  title,
  description,
  closeLabel = 'Close',
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-(--z-overlay) bg-foreground/40"
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-(--z-modal) mx-auto flex max-h-[90dvh] w-full max-w-(--content-max) flex-col',
          'rounded-t-xl border-t border-border bg-card text-card-foreground shadow-lg outline-none pb-safe',
          className
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex items-start gap-3 px-4 pt-3">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-lg font-extrabold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={closeLabel}
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
```

### packages/web/src/components/ThreadView.tsx

```tsx
import { useEffect, useState } from 'react'
import type { Comment, Task } from '@kanban/shared'
import { readMoreId } from '../lib/messages.ts'
import { activeNeed } from '../lib/threads.ts'
import { useReply } from '../lib/use-reply.ts'
import { useThreadActions, type SheetMode } from '../lib/use-thread-actions.ts'
import { useUnreadCleared } from '../lib/use-unread-cleared.ts'
import DecisionSheet from './DecisionSheet.tsx'
import HistorySheet from './HistorySheet.tsx'
import MessageList from './MessageList.tsx'
import ThreadFooter from './ThreadFooter.tsx'
import ThreadHeader from './ThreadHeader.tsx'

// Keeps the newest message in view as the conversation grows (the page scrolls; the header and
// footer are sticky): on open, on a new message and when the typing dots come or go.
function useStickToBottom(messageCount: number, working: boolean) {
  useEffect(() => {
    const page = document.scrollingElement
    if (page) page.scrollTop = page.scrollHeight
  }, [messageCount, working])
}

// One loaded thread: header with stepper, the conversation, and the footer (quick replies and
// composer, or the done note). Keyed by task id by the page, so each thread starts fresh.
export default function ThreadView({
  task,
  comments,
  projectName,
  live,
  now,
}: {
  task: Task
  comments: Comment[]
  projectName: string | null
  live: boolean
  now: number
}) {
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const actions = useThreadActions((_task, mode) => setSheet(mode))
  const reply = useReply(task, comments)
  useUnreadCleared(task)
  useStickToBottom(reply.messages.length, task.working === true)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-(--content-max) flex-col">
      <ThreadHeader
        task={task}
        projectName={projectName}
        live={live}
        onHistory={() => setHistoryOpen(true)}
      />
      <main className="flex-1 px-4">
        <MessageList
          messages={reply.messages}
          now={now}
          readMoreId={readMoreId(reply.messages, activeNeed(task))}
          working={task.working === true}
          onReadMore={() => setSheet('read')}
        />
      </main>
      <ThreadFooter
        task={task}
        now={now}
        reply={reply}
        onQuickReply={(quick) => actions.reply(task, quick)}
      />
      {sheet ? <DecisionSheet task={task} mode={sheet} onClose={() => setSheet(null)} /> : null}
      {historyOpen ? <HistorySheet task={task} onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  )
}
```

### packages/web/src/pages/Threads.tsx

```tsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav.tsx'
import DecisionSheet from '../components/DecisionSheet.tsx'
import { ALL_PROJECTS } from '../components/ProjectChips.tsx'
import ThreadList from '../components/ThreadList.tsx'
import { ForJamesRow, TaskRow } from '../components/ThreadRow.tsx'
import ThreadsHeader from '../components/ThreadsHeader.tsx'
import type { ThreadRow } from '../lib/threads.ts'
import { track, useThreadActions, type SheetMode } from '../lib/use-thread-actions.ts'
import { useThreadsBoard } from '../lib/use-threads-board.ts'

const PROJECT_PARAM = 'project'

type Board = ReturnType<typeof useThreadsBoard>
type Actions = ReturnType<typeof useThreadActions>

function rowView(row: ThreadRow, board: Board, actions: Actions) {
  if (row.kind === 'for_james')
    return (
      <ForJamesRow
        key={`for_james:${row.projectId}`}
        projectId={row.projectId}
        projectName={board.nameOf.get(row.projectId) ?? row.projectId}
        todos={row.todos}
        at={row.at}
        now={board.now}
        onOpen={actions.openForJames}
      />
    )
  return (
    <TaskRow
      key={row.task.id}
      task={row.task}
      projectName={board.nameOf.get(row.task.projectId) ?? row.task.projectId}
      live={board.liveProjects.has(row.task.projectId)}
      now={board.now}
      onOpen={actions.openThread}
      onReply={actions.reply}
    />
  )
}

export default function Threads() {
  const [params, setParams] = useSearchParams()
  const filter = params.get(PROJECT_PARAM) ?? ALL_PROJECTS
  const board = useThreadsBoard(filter)
  const [sheet, setSheet] = useState<{ taskId: string; mode: SheetMode } | null>(null)
  const actions = useThreadActions((task, mode) => setSheet({ taskId: task.id, mode }))
  const sheetTask = sheet ? board.tasks.data.find((t) => t.id === sheet.taskId) : undefined
  const waiting = board.countFor(filter)

  function selectProject(projectId: string) {
    const next = new URLSearchParams(params)
    if (projectId === ALL_PROJECTS) next.delete(PROJECT_PARAM)
    else next.set(PROJECT_PARAM, projectId)
    // Replace, so Back from a thread lands on Threads once with the same filter.
    setParams(next, { replace: true })
    void track('filter', projectId)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-(--content-max) flex-col">
      <ThreadsHeader
        waiting={waiting}
        projects={board.projects.data}
        filter={filter}
        countFor={board.countFor}
        onSelect={selectProject}
      />

      <main className="flex-1 pb-28">
        <ThreadList
          loading={board.loading}
          failed={board.failed}
          rows={board.rows}
          render={(row) => rowView(row, board, actions)}
        />
      </main>

      <BottomNav />
      {sheet && sheetTask ? (
        <DecisionSheet task={sheetTask} mode={sheet.mode} onClose={() => setSheet(null)} />
      ) : null}
    </div>
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

### tests/fixtures/web-threads-b3.tsx

```tsx
// Shared fixture for the web-threads B3 suites (the thread view). Builds on the B2 fixture: same
// task builder, board, action spies and logger spy. Adds comment builders, the thread's live
// sources (task + comments, which can push a new snapshot while the screen is mounted), the
// B3 data.ts names, a HistorySheet stand-in, and a router that mounts the thread on /t/:taskId.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B3)).dataModule())
import { useSyncExternalStore, type ReactNode } from 'react'
import { vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { AgentDoc, Comment, CommentKind, Task } from '../../packages/shared/src/index.ts'
import {
  NOW,
  actions,
  board,
  dataModule as b2DataModule,
  isBefore,
  live,
  setBoard,
  type LiveStub,
} from './web-threads-b2.tsx'

export const TASK_ID = 't1'

// ---- comments ---------------------------------------------------------------------

const comment = (id: string, over: Partial<Comment>): Comment => ({
  id,
  taskId: TASK_ID,
  projectId: 'p-kanban',
  agentId: 'agent-1',
  author: 'agent',
  kind: 'info',
  body: `Comment ${id}`,
  createdAt: NOW,
  deliveredAt: null,
  workingAt: null,
  handledAt: null,
  ...over,
})

// A session message of `kind` (any string, so an unknown kind can be fed in).
export const sessionMsg = (id: string, kind: string, body: string, at: number) =>
  comment(id, { author: 'agent', kind: kind as CommentKind, body, createdAt: at })

// One of James's messages; delivery stamps via `over`.
export const jamesMsg = (id: string, body: string, at: number, over: Partial<Comment> = {}) =>
  comment(id, { author: 'james', kind: 'comment', body, createdAt: at, ...over })

// ---- mocked data.ts (thread sources + B3 actions) ----------------------------------

export const thread = {
  taskId: TASK_ID,
  task: live<Task | null>(null),
  comments: live<Comment[]>([]),
}
// What useTask / useTaskComments return for an id other than the routed one.
const OTHER_TASK = live<Task | null>(null)
const OTHER_COMMENTS = live<Comment[]>([])

let seq = 0
const nextId = () => `c-new-${++seq}`
const resolved = (_task: Task, _reply: { id: string; body: string }) => Promise.resolve()

export const b3Actions = {
  newCommentId: vi.fn(nextId),
  sendReply: vi.fn(resolved),
}

// Snapshot delivery: the thread hooks subscribe here, so pushThread re-renders the screen the
// way a Firestore snapshot does.
let version = 0
const listeners = new Set<() => void>()
function useSnapshots() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
}

// A new snapshot of the task and/or the comments while the screen is mounted.
export function pushThread(next: { task?: Task | null; comments?: Comment[] }) {
  act(() => {
    if (next.task !== undefined) thread.task = live(next.task)
    if (next.comments !== undefined) thread.comments = live(next.comments)
    version++
    for (const listener of listeners) listener()
  })
}

// Loads one thread (task + comments, everything loaded, no errors), resets every spy.
// `tasks` feeds Threads' useAllTasks (defaults to just this task).
export function setThread(
  task: Task | null,
  opts: { comments?: Comment[]; agents?: AgentDoc[]; tasks?: Task[]; taskId?: string } = {}
) {
  setBoard({ tasks: opts.tasks ?? (task ? [task] : []) })
  board.agents = live(opts.agents ?? [])
  thread.taskId = task?.id ?? opts.taskId ?? TASK_ID
  thread.task = live(task)
  thread.comments = live(opts.comments ?? [])
  seq = 0
  b3Actions.newCommentId.mockReset()
  b3Actions.newCommentId.mockImplementation(nextId)
  b3Actions.sendReply.mockReset()
  b3Actions.sendReply.mockImplementation(resolved)
}

export const dataModule = () => ({
  ...b2DataModule(),
  useTask: (id: string | undefined): LiveStub<Task | null> => {
    useSnapshots()
    return id === thread.taskId ? thread.task : OTHER_TASK
  },
  useTaskComments: (id: string | undefined): LiveStub<Comment[]> => {
    useSnapshots()
    return id === thread.taskId ? thread.comments : OTHER_COMMENTS
  },
  ...b3Actions,
})

// A write that never settles (offline: Firestore keeps it queued) and a permanent failure.
export const pendingWrite = () => new Promise<void>(() => {})
export const deniedWrite = () =>
  Promise.reject(
    Object.assign(new Error('Missing or insufficient permissions.'), {
      name: 'FirebaseError',
      code: 'permission-denied',
    })
  )

export { actions }

// ---- HistorySheet stand-in (its contents are B6's) ---------------------------------

export function HistorySheetStandIn(props: { task: Task; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="History sheet">
      <p>{`history: ${props.task.title}`}</p>
      <button type="button" onClick={props.onClose}>
        Close history
      </button>
    </div>
  )
}
export const historyModule = () => ({ default: HistorySheetStandIn })

// ---- rendering --------------------------------------------------------------------

function WhereAmI() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

type Entry = string | { pathname: string; search?: string; state?: unknown }

// Mounts the thread view on /t/:taskId and `home` (default: a placeholder) on /; the probe
// prints the URL (read it with the B2 fixture's `where`).
export function renderThread(
  entry: Entry,
  threadView: ReactNode,
  home: ReactNode = <h1>Threads home</h1>
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/t/:taskId" element={threadView} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <WhereAmI />
    </MemoryRouter>
  )
}

// ---- reading the screen -----------------------------------------------------------

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// An element's visible-to-a-reader text: its text nodes joined by a space (textContent would
// glue neighbouring elements, "sent" + "Send" → "sentSend"), skipping the composer's own
// contents (a textarea's value can be mirrored into its text) and the location probe.
function textOf(root: Node): string {
  const parts: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('textarea, [data-testid="location"]')) continue
    parts.push(node.textContent ?? '')
  }
  return norm(parts.join(' '))
}

// The whole page's text, as textOf reads it.
export const threadText = () => textOf(document.body)

// The text after the first occurrence of `text`, up to `until` when given.
export function textAfter(text: string, until?: string): string {
  const all = threadText()
  const start = all.indexOf(text)
  if (start < 0) throw new Error(`"${text}" is not on screen`)
  const rest = all.slice(start + text.length)
  if (until === undefined) return rest
  const end = rest.indexOf(until)
  return end < 0 ? rest : rest.slice(0, end)
}

export const occurrences = (text: string) => threadText().split(text).length - 1

// The innermost element whose text contains `text` (outside the composer).
export function deepest(text: string): HTMLElement {
  const want = norm(text)
  const hits = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (el) => !el.closest('textarea, [data-testid="location"]') && textOf(el).includes(want)
  )
  const inner = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)))
  if (inner.length === 0) throw new Error(`"${text}" is not on screen`)
  return inner[0]
}

// The first of the given nodes in document order.
export const firstOf = (...nodes: HTMLElement[]) => nodes.reduce((a, b) => (isBefore(b, a) ? b : a))

export const composer = () => screen.getByRole('textbox', { name: 'Message to the session' })
export const queryComposer = () => screen.queryByRole('textbox', { name: 'Message to the session' })
export const sendButton = () => screen.getByRole('button', { name: 'Send' })
export const readMoreButtons = () => screen.queryAllByRole('button', { name: 'Read more' })
```

### tests/web-threads-b3-28.test.tsx

```tsx
// @vitest-environment jsdom
// web-threads shared criterion 28, the reply half (owned by B3): offline, a reply shows at once
// with one tick and stays while the write is queued; when the network returns the snapshot
// carries it and the ticks advance; a permanently failed write removes the message, puts the
// text back, shows an inline error and logs api_call_failed with the Firestore code.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { MINUTE, NOW, installClock, logSpy, makeTask } from './fixtures/web-threads-b2.tsx'
import {
  b3Actions,
  composer,
  deniedWrite,
  jamesMsg,
  occurrences,
  pendingWrite,
  pushThread,
  renderThread,
  sendButton,
  sessionMsg,
  setThread,
  textAfter,
  threadText,
} from './fixtures/web-threads-b3.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const task = makeTask('t1', { title: 'Build the cache', stage: 'build' })
const history = [sessionMsg('c1', 'info', 'Started on the cache', NOW - 30 * MINUTE)]
const BODY = 'Use Redis for this'
const ERROR = /Couldn.t send\. Try again\./

async function reply(write: () => Promise<void>) {
  setThread(task, { comments: history })
  b3Actions.sendReply.mockImplementation(write)
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  await user.click(composer())
  await user.keyboard(BODY)
  await user.click(sendButton())
  return user
}
const sentId = () => b3Actions.sendReply.mock.calls[0][1].id

describe('B3-28 a reply while offline', () => {
  installClock()

  it('shows at once with one tick and stays while the write is queued', async () => {
    await reply(pendingWrite)
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(1)
    expect((composer() as HTMLTextAreaElement).value).toBe('')
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toMatch(/\bsent\b/)
    expect(screen.queryByRole('alert')).toBeNull()
    // Unrelated snapshots arrive (a session message); the queued reply stays, still one tick.
    pushThread({
      comments: [...history, sessionMsg('c2', 'info', 'Still going', NOW - MINUTE)],
    })
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toMatch(/\bsent\b/)
  })

  it('when the network returns, the snapshot carries it once and the ticks advance', async () => {
    await reply(pendingWrite)
    const echo = jamesMsg(sentId(), BODY, NOW)
    pushThread({ comments: [...history, echo] })
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toMatch(/\bsent\b/)
    pushThread({ comments: [...history, { ...echo, deliveredAt: NOW + 1 }] })
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toContain('received')
    pushThread({
      comments: [...history, { ...echo, deliveredAt: NOW + 1, workingAt: NOW + 2 }],
    })
    expect(textAfter(BODY)).toContain('working on it')
  })
})

describe('B3-28 a reply whose write fails for good', () => {
  installClock()

  it('removes the message, puts the text back and shows an inline error', async () => {
    await reply(deniedWrite)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(ERROR)
    expect(threadText()).not.toContain(BODY)
    expect((composer() as HTMLTextAreaElement).value).toBe(BODY)
  })

  it('logs api_call_failed with the Firestore code under the reply request id', async () => {
    await reply(deniedWrite)
    await screen.findByRole('alert')
    const failed = logSpy.error.mock.calls.filter((call) => call[0] === 'api_call_failed')
    expect(failed).toHaveLength(1)
    const context = failed[0][2] as Record<string, unknown>
    expect(context).toEqual(
      expect.objectContaining({
        feature: 'web-threads',
        action: 'reply',
        target: 'firestore',
        status: 'permission-denied',
      })
    )
    const tapped = logSpy.event.mock.calls.find(
      (call) => call[0] === 'user_action' && (call[1] as { action?: string }).action === 'reply'
    )
    expect(tapped).toBeTruthy()
    const requestId = (tapped?.[1] as { request_id?: unknown }).request_id
    expect(typeof requestId).toBe('string')
    expect(context.request_id).toBe(requestId)
  })

  it('the restored text can be sent again', async () => {
    const user = await reply(deniedWrite)
    await screen.findByRole('alert')
    b3Actions.sendReply.mockImplementation(pendingWrite)
    await user.click(sendButton())
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(2)
    expect(b3Actions.sendReply.mock.calls[1][1].body.trim()).toBe(BODY)
    expect(occurrences(BODY)).toBe(1)
  })
})
```

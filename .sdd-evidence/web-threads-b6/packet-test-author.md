# Test-author packet — web-threads B6 (History and Reopen)

Role: `test`. You write acceptance tests only. You never implement. You have not seen any
plan discussion; the only inputs are this packet and the files it quotes. Snapshot: commit
cb6b71e on branch feat/web-threads-b6 (clean tree). B1–B5 are merged; their code is real and
quoted below where B6 builds on it.

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
  `tests/fixtures/web-threads-b2.tsx` … `-b5.tsx`. Reuse them by importing; put anything new
  for B6 in one new module `tests/fixtures/web-threads-b6.tsx`.
- Emulator tests (`npm run test:rules`, `vitest.rules.config.ts`): `tests/emulator/*.test.ts`
  run the real `packages/web/src/data.ts` against the Firestore emulator as James, with
  `firebase.ts` and `lib/log.ts` mocked; `tests/fixtures/web-threads-b4-emulator.ts` and
  `-b5-emulator.ts` are the shared setup (quoted below). Reuse them; anything new goes in one
  new module `tests/fixtures/web-threads-b6-emulator.ts`.
  Do not edit any existing test or fixture file.

## Assigned criteria (from docs/features/web-threads.md, verbatim)

### B6 — History and Reopen

25. Given a task, when the History sheet opens, it lists decision entries newest last with
    who (James / session / system), time and text, and says "Nothing recorded yet" when
    empty; chat messages are not in it.
26. Given a done task, when James taps Reopen, a sheet asks for a note (required); Save
    sets `doneAt` null, moves the stage to the one before `done` (re-arming the
    after-deploy need when that stage is `after_deploy`), sends "Reopened: <note>" as
    James's message with kind `reopen`, adds the system line "Reopened by you", records
    "Reopened: <note>" and sets `reopenedAt`.
27. Given a reopened task, when Threads renders, it is back in the lists regardless of
    how old `doneAt` was.

Shared criteria that apply to the History and Reopen sheets:

29. Given any screen, when loading, an unobtrusive loading state shows; when Firestore
    rejects a read, an error state with a retry shows; empty lists have the prototype's
    empty copy.
30. Given keyboard-only use, when traversing any screen, every control is reachable, has a
    visible focus ring and an accessible name; chips expose `aria-pressed`; nav exposes
    `aria-current`.

For 29 on these sheets: the archive read shows a loading status and an error with Retry when
it fails (B2/B3 pattern); a failed reopen is the inline alert the contract gives. Criterion 30
in jsdom: keyboard reachability, names and focus behaviour (trap, Escape, focus return as in
B4's criterion 20) are observable; the visible focus ring is CSS, checked at review. Criterion
28 does not apply (reopen is a transaction, like B4's decisions).

Not assigned to B6: anything the session does; briefs and voice (a later spec).

## Selected new contract (planner decisions, recorded in the spec; exact names tests may assert)

**B6 contract details fixed at test time** (planner decisions, 2026-11-04):

- History sheet (`packages/web/src/components/HistorySheet.tsx`, same props `{ task, onClose }`,
  opened from the thread's `Decision history` button and from a done task's `History` button on
  the project Done tab): a dialog named `Decision history` with the task title as its heading.
  It lists `task.log` entries oldest first (newest last), each with who (`You` for james,
  `Session` for session, `Board` for system), its time (`Today HH:MM`, `Yesterday HH:MM`, else
  `<day> <Mon> HH:MM`, always day first with an English month abbreviation such as
  `24 Oct 13:00`, in the device's time zone and whatever its locale) and its text. No entries: `Nothing recorded yet.` Comments never appear
  in it. When the task's log is at `LOG_CAP` (older entries were archived), a button
  `Show earlier history` loads `tasks/{id}/log_archive` (new hook `useLogArchive(taskId,
enabled)` in `data.ts`, `Live`, ordered by `at`) and lists those entries above the rest. A
  done task's sheet also has a `Reopen task` button that opens the Reopen sheet.
- Reopen: a `Reopen` button in a done task's thread footer, a `Reopen` button on each card of
  the project Done tab, and `Reopen task` in the History sheet open
  `packages/web/src/components/ReopenSheet.tsx` (default export, props `{ task, onClose }`):
  a dialog named `Reopen task`, the task title as heading, the line `Goes back to the
after-deploy checklist so you can untick a step. Your note is sent to the session.` when the
  stage before done is `after_deploy`, else `Goes back to <STAGE_LABEL of the previous stage>.
Your note is sent to the session as the first thing it reads.`; a textarea labelled
  `What is wrong, or what should happen now?`; buttons `Reopen and send` (disabled while the
  trimmed note is empty or the save is pending) and `Cancel` (no write). Saving calls
  `reopenTask(task, note)` once; when it resolves the sheet closes and, if James is not
  already on that thread, he is taken to `/t/<id>`. If it rejects: `role="alert"`
  `Couldn't save. Try again.`, the note kept.
- `reopenTask(task, note)` in `data.ts` (tested in the emulator): a transaction guarded on stage
  `done` (anything else writes nothing and resolves); note trimmed, required (blank writes
  nothing), capped at 4000. It sets `doneAt: null`, `reopenedAt` now, stage the one before
  `done` in the task's own chain, `needs: { kind: 'after_deploy' }` when that stage is
  `after_deploy` else `null`, appends history `Reopened: <note>` (`who: 'james'`, through
  `appendLog` with archive overflow as in B4), and writes James's comment kind `reopen` with
  body `Reopened: <note>`. `afterDone` is left as it is (James unticks the step himself).
- The system line `Reopened by you`: not stored (the B1 rules keep system lines agent-only, as
  in B5). The thread view shows a quiet `Reopened by you` line at the time of each history entry
  that starts `Reopened:` with `who: 'james'`, in time order with the messages.
- Criterion 27 needs no new code beyond `doneAt: null`: a reopened task is not done, so it is in
  Threads and the Live tab whatever its old `doneAt` was; tests assert it on screen.
- Instrumentation, through `track`: `user_action` `reopen` (target the task id);
  `milestone_reached` `task_reopened` (target the task id, same `request_id`) once
  `reopenTask` resolves; a failed write logs `api_call_failed`. Opening the History sheet is not
  logged.

Earlier contract blocks B6 builds on (B2–B5, verbatim from the spec):

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

**B5 contract details fixed at test time** (planner decisions, 2026-11-04):

- Screens and routes, replacing the Phase 1 pages (`pages/Home.tsx`, `pages/Board.tsx` and the
  `ui.tsx` / `lib/legacy-status.ts` pieces only they use are retired): `pages/Projects.tsx` at
  `/projects`, `pages/Project.tsx` at `/p/:projectId` (tab in the `tab` search param: `live`
  default, `james`, `done`), `pages/NewTask.tsx` at `/new` (`?project=<id>` preselects the
  project). Each renders `BottomNav`. Data from `data.ts`: `useProjects`, `useAgents`,
  `useAllTasks`, `useOpenTodos`, `useProject(id)`, `useProjectTasks(id)`,
  `useProjectTodos(id)` (all `Live` with `retry()`); writes `createTask`, `toggleTodo`,
  `addTodo`. Those are the only `data.ts` names these screens import.
- Projects: heading `Projects`, and `<N> sessions live` (projects with an online agent;
  `1 session live`). One link per project (in `useProjects` order) to `/p/<id>`, named by the
  project name, showing the host (`hostname`), `session live` or `no session` (the live dot
  carries this text), and counts: `<N> need you` (only when above zero, same count as the
  Threads chip), `<N> live` (visible tasks that are not done, `for_james` excluded),
  `<N> done this week` (done within 7 days), `<N> for James` (open todos, only when above
  zero). No projects: `No projects yet. Start a Claude session in a folder to add one.`
- Project: a `Back to projects` link to `/projects`; heading the project name; under it
  `<host> · session live` or `<host> · no session`; a `+ Task` link to `/new?project=<id>`.
  Tabs are buttons with `aria-pressed`: `Live · <N>`, `For James · <open N>`,
  `Done · <N within 7 days>`; choosing one sets `tab`.
  - Live: tasks not done (`for_james` excluded), needing James first, then most recently
    updated. Each is a link to `/t/<id>` with its type, `stageText`, title, the
    `StageStepper`, and `<N> after-deploy step(s) for you at the end` when it has steps.
    None: `Nothing live. Queue a task from New task.`
  - For James: the project's todos, open before done, newest first. Each has a checkbox
    labelled by its text (ticking calls `toggleTodo`), and an `Open` link to `todo.link` in a
    new tab when the link is http/https and the todo is open. A text field labelled
    `Add something to do by hand` and an `Add` button (disabled while the trimmed text is
    empty) call `addTodo(projectId, text)`. None: `Nothing for you to do by hand.`
  - Done: tasks done within 7 days, newest `doneAt` first, each a link to `/t/<id>` with its
    title, summary and `done <relative time>`. When older done tasks exist, a button
    `Show <N> older` reveals them below (newest first) and becomes `Hide <N> older`.
    None within 7 days: `Nothing finished this week.` History and Reopen are B6's.
- New task: a select labelled `Project` (projects by name; default the `project` param, else
  the first project), type buttons `Feature`, `Bug fix`, `Chore` with `aria-pressed`
  (default Feature), a field labelled `Title` (required), a textarea labelled
  `Description for the session`, a checkbox labelled `I have steps to do after deploy` that
  reveals a textarea labelled `One per line`, and a preview `Stages: <labels joined by
" → ">` from `stagesFor(type, has steps)` and `STAGE_LABEL`, updating as the choices
  change. `Queue task` is disabled while the trimmed title is empty or the save is pending.
  Saving calls `createTask(projectId, { type, title, description, afterDeploy })` once, with
  the title and description trimmed and the steps split by line, trimmed, blanks dropped;
  when it resolves it navigates to `/`. If it rejects: `role="alert"`
  `Couldn't save. Try again.`, the form kept.
- `createTask` (tested in the emulator): writes the task from `initialTaskFields` (stage the
  first of its chain, `agentId: null`, so queued), title and description trimmed and capped
  (title 200, description 4000), `afterDeploy` the steps (each capped at 300, at most 20) with
  `afterDone` all false, and one history entry `who: 'james'`: `Queued: <title>`, plus
  ` · 1 after-deploy step` or ` · <N> after-deploy steps` when there are steps. It returns the
  new id. A blank title writes nothing and rejects. `addTodo` trims, refuses blank text
  (writes nothing) and caps at 500.
- The queue line (criterion 23's "system message"): the B1 rules forbid the browser from
  writing session or system comments, so it is not stored. While a task created by James is
  queued and its thread has no messages, the thread view shows the quiet line
  `Queued by you · waiting for a session in <project name>` instead of `No messages yet.`;
  it goes once the session posts.
- Instrumentation, through `track` (one `request_id` per tap): `user_action` with action
  `queue_task` (target the new task id), `todo_add` (target the project id), `todo_done` or
  the untick (target the todo id); `milestone_reached` `task_queued` (target the task id)
  after `createTask` resolves; failed writes log `api_call_failed` with the Firestore code.

- Fidelity round 1 decisions (B5): unticking a todo logs `user_action` with action
  `todo_undone` (target the todo id), added to the Instrumentation table. `queue_task` is
  logged once `createTask` resolves, so its target is the new task id, and the
  `task_queued` milestone carries the same `request_id`; a pending or refused save logs no
  `queue_task` and no milestone (a refused save logs `api_call_failed`). Windows are the shared
  constants, not literal durations: online is `lastSeen` within `AGENT_STALE_MS`, "this week"
  is `DONE_VISIBLE_MS` (both may change; tests derive their edges from them).

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
  emulator; on this machine prefix `PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH"`.
- Component tests follow the B2–B5 pattern: `vi.mock` of `data.ts`, `firebase.ts`,
  `lib/log.ts`; `MemoryRouter` with a location probe; Date-only fake clock. Radix sheets render
  in a portal under `document.body`; `screen` reaches them (B4-20 quoted below shows focus
  trap / Escape / focus return). A pending write is a promise that never settles; a refused
  write is `Promise.reject(Object.assign(new Error('x'), { name: 'FirebaseError', code: 'permission-denied' }))`.
- Emulator tests follow `tests/emulator/web-threads-b4-16.test.ts` and the emulator fixtures
  (quoted below): seed, call the real write, read the documents back as James.
- Lint runs on tests at commit; the `no-unsafe-*` rules are off for `tests/**`.

## Output format

- Component files: `tests/web-threads-b6-25.test.tsx` (History sheet), `-26` (Reopen sheet and
  its openers, the derived `Reopened by you` line), `-27` (a reopened task back in the lists),
  `-29` and `-30` (the two sheets), plus optionally `tests/fixtures/web-threads-b6.tsx`.
- Emulator files: `tests/emulator/web-threads-b6-26.test.ts` (`reopenTask` stores what the
  contract says, its guard, history overflow) and `tests/emulator/web-threads-b6-25.test.ts`
  (the archive read in `at` order), plus optionally `tests/fixtures/web-threads-b6-emulator.ts`.
- Run `npx vitest run tests/web-threads-b6`,
  `PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH" npm run test:rules` and
  `npx vitest run`, and report the verbatim summaries. Every new test must FAIL because the
  behaviour is missing (a missing export, a missing control, a missing write), not because of
  a mistake in the test. List exactly which new tests pass at red and why. The B1–B5 tests
  must still pass.
- Report: file list with line counts, the tails, `npx eslint tests/`, and any contract
  detail you had to assume.

## Observed baseline (source excerpts, commit cb6b71e)

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
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  COLLECTIONS,
  appendLog,
  forJamesTaskId,
  initialTaskFields,
  type AgentDoc,
  type Comment,
  type CommentKind,
  type LogEntry,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { db } from './firebase.ts'
import { log } from './lib/log.ts'
import {
  MAX_COMMENT_CHARS,
  MAX_DESCRIPTION_CHARS,
  MAX_STEPS,
  MAX_STEP_CHARS,
  MAX_TITLE_CHARS,
  MAX_TODO_CHARS,
} from './lib/limits.ts'
import { jamesComment, replyKind } from './lib/messages.ts'
import { newRequestId } from './lib/request-id.ts'
import { specVersion } from './lib/threads.ts'

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
const LOG_ARCHIVE = 'log_archive'

// Free text from James: trimmed and capped before it is written anywhere. A text that gets a
// prefix in his message is capped so the whole message fits, which keeps the message and the
// history line on the same words.
const cleanText = (text: string, max = MAX_COMMENT_CHARS): string =>
  text.trim().slice(0, max).trimEnd()

export interface NewTaskInput {
  type: TaskType
  title: string
  description: string
  afterDeploy: string[]
}

// "Queued: <title>", plus the number of after-deploy steps when there are any.
function queuedEntry(title: string, steps: number): string {
  if (steps === 0) return `Queued: ${title}`
  return `Queued: ${title} · ${steps} after-deploy ${steps === 1 ? 'step' : 'steps'}`
}

// James queues a task for the next session in a project: the shared initial shape (first stage of
// its chain, bound to no agent), his text trimmed and capped, one history line by him, and the
// project touched so it moves up the list. One batch, so the task and the touch land together
// (or, offline, are queued together). A blank title writes nothing and rejects. Returns the id.
export async function createTask(projectId: string, input: NewTaskInput): Promise<string> {
  const title = cleanText(input.title, MAX_TITLE_CHARS)
  if (title === '') throw new Error('A task needs a title')
  const steps = input.afterDeploy
    .map((step) => cleanText(step, MAX_STEP_CHARS))
    .filter((step) => step !== '')
    .slice(0, MAX_STEPS)
  const t = now()
  const ref = doc(collection(db, COLLECTIONS.tasks))
  const task = initialTaskFields({
    projectId,
    type: input.type,
    title,
    description: cleanText(input.description, MAX_DESCRIPTION_CHARS),
    createdBy: 'james',
    afterDeploy: steps,
    now: t,
  })
  const entry: LogEntry = { at: t, who: 'james', text: queuedEntry(title, steps.length) }
  const batch = writeBatch(db)
  batch.set(ref, { ...task, log: [entry] })
  batch.update(doc(db, COLLECTIONS.projects, projectId), { updatedAt: t })
  await batch.commit()
  return ref.id
}

// A decision James makes: read the task inside a transaction and write only when `plan` accepts
// its current state, so a double tap (or a stale screen) is a no-op. The plan names what changes
// on the task, the one history line, and James's message; all of it lands in this transaction.
// The history goes through appendLog; whatever it pushes past LOG_CAP is moved to
// tasks/{id}/log_archive in the same write, one document per entry.
interface Transition {
  patch: Partial<Task>
  history: string
  comment: { kind: CommentKind; body: string }
}
async function transitionTask(
  taskId: string,
  plan: (current: Task) => Transition | null
): Promise<void> {
  const taskRef = doc(db, COLLECTIONS.tasks, taskId)
  const commentRef = doc(collection(db, COLLECTIONS.comments))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(taskRef)
    if (!snap.exists()) return
    const current = { ...(snap.data() as Task), id: snap.id }
    const next = plan(current)
    if (!next) return
    const t = now()
    const entry: LogEntry = { at: t, who: 'james', text: next.history }
    const { log: kept, archived } = appendLog(Array.isArray(current.log) ? current.log : [], entry)
    const archive = collection(db, COLLECTIONS.tasks, taskId, LOG_ARCHIVE)
    for (const old of archived) tx.set(doc(archive), { at: old.at, who: old.who, text: old.text })
    tx.update(taskRef, { ...next.patch, log: kept, updatedAt: t, lastCommentAt: t })
    tx.set(
      commentRef,
      jamesComment(current, next.comment.kind, next.comment.body, t, commentRef.id)
    )
  })
}

const CHANGE_PREFIX = 'Change: '

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
          history: `Approved spec v${specVersion(cur)}`,
          comment: { kind: 'approve', body: 'Approved.' },
        }
      : null
  )
}

// "Small change…": the need is cleared and the stage stays, so the session revises the spec.
// Empty text writes nothing.
export async function requestChange(task: Task, text: string) {
  const change = cleanText(text, MAX_COMMENT_CHARS - CHANGE_PREFIX.length)
  if (change === '') return
  await transitionTask(task.id, (cur) =>
    cur.needs?.kind === 'spec'
      ? {
          patch: { needs: null },
          history: `Asked for a change to spec v${specVersion(cur)}: ${change}`,
          comment: { kind: 'change_request', body: `${CHANGE_PREFIX}${change}` },
        }
      : null
  )
}

// An answer: an option (its key must still be on offer) or James's own words (label only). His
// message carries the label and the need is cleared; only while the task still waits on a
// question, so a double tap or a stale option writes nothing.
export async function answerQuestion(task: Task, answer: { key?: string; label: string }) {
  const label = cleanText(answer.label)
  if (label === '') return
  await transitionTask(task.id, (cur) => {
    const need = cur.needs
    if (need?.kind !== 'question') return null
    if (answer.key !== undefined && !need.options?.some((o) => o.key === answer.key)) return null
    return {
      patch: { needs: null },
      history: need.question ? `Answered ${need.question}: ${label}` : `Answered: ${label}`,
      comment: { kind: 'answer', body: label },
    }
  })
}

// "Merged it": only from stage `pr`, so a second tap (or a stale row) writes nothing.
export async function markMerged(task: Task) {
  await transitionTask(task.id, (cur) =>
    cur.stage === 'pr'
      ? {
          patch: { stage: 'merged', needs: null },
          history: cur.pr ? `Merged PR #${cur.pr.number}` : 'Merged the PR',
          comment: { kind: 'merged', body: 'Merged it.' },
        }
      : null
  )
}

// Ticks (or unticks) one after-deploy step. A batch built from the task as the screen has it, so
// a tick made offline is queued and shows at once. History goes in with arrayUnion (the next
// transactional writer enforces LOG_CAP). The tick that leaves every step done also closes the
// task: stage done, doneAt, need and working cleared, the "Done" history line and James's
// closing message, all in the same batch.
export async function tickStep(task: Task, index: number) {
  const steps = Array.isArray(task.afterDeploy) ? task.afterDeploy : []
  if (
    task.stage !== 'after_deploy' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= steps.length
  )
    return
  const afterDone = steps.map((_, i) =>
    i === index ? !task.afterDone?.[i] : !!task.afterDone?.[i]
  )
  const t = now()
  const ticked = afterDone[index]
  const step: LogEntry = {
    at: t,
    who: 'james',
    text: `${ticked ? 'Step done' : 'Step unticked'}: ${steps[index]}`,
  }
  const batch = writeBatch(db)
  const taskRef = doc(db, COLLECTIONS.tasks, task.id)
  if (afterDone.every(Boolean)) {
    const commentRef = doc(collection(db, COLLECTIONS.comments))
    const closed: LogEntry = { at: t, who: 'system', text: 'Done' }
    batch.update(taskRef, {
      afterDone,
      log: arrayUnion(step, closed),
      stage: 'done',
      doneAt: t,
      needs: null,
      working: false,
      updatedAt: t,
      lastCommentAt: t,
    })
    batch.set(
      commentRef,
      jamesComment(task, 'comment', 'After-deploy steps done.', t, commentRef.id)
    )
  } else {
    batch.update(taskRef, { afterDone, log: arrayUnion(step), updatedAt: t })
  }
  await batch.commit()
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

// A hand-done item James adds to a project's For James list: trimmed, capped, never blank (a
// blank text writes nothing and rejects).
export async function addTodo(projectId: string, body: string) {
  const text = cleanText(body, MAX_TODO_CHARS)
  if (text === '') throw new Error('A to-do needs some text')
  const ref = doc(collection(db, COLLECTIONS.todos))
  const todo: Todo = {
    id: ref.id,
    projectId,
    body: text,
    link: null,
    done: false,
    sourceTaskId: null,
    createdAt: now(),
    doneAt: null,
  }
  await setDoc(ref, todo)
}

export { forJamesTaskId }
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

export function stepCount(task: Pick<Task, 'afterDeploy'>): number {
  return Array.isArray(task.afterDeploy) ? task.afterDeploy.length : 0
}

// The version the spec sheet and its history lines call the spec: 1 while there is no spec.
export const specVersion = (task: Pick<Task, 'spec'>): number => task.spec?.version ?? 1

// Only web links may leave the app from a Firestore-supplied URL (never javascript:, data:).
export function webUrl(value: unknown): string | null {
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

export function questionOptions(need: TaskNeed): { key: string; label: string }[] {
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
// composer and the decision sheet use the result to take their optimistic copy back. `onSuccess`
// runs once the write has gone through, with the tap's request id, for events that follow it.
export async function track(
  action: string,
  target: string,
  write?: () => Promise<unknown>,
  onSuccess?: (requestId: string) => void
): Promise<boolean> {
  const requestId = newRequestId()
  log.event('user_action', { feature: FEATURE, action, target, request_id: requestId })
  if (!write) return true
  try {
    await write()
  } catch (err) {
    reportFailure(action, requestId, err)
    return false
  }
  onSuccess?.(requestId)
  return true
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

### packages/web/src/components/HistorySheet.tsx

```tsx
import type { Task } from '@kanban/shared'
import { Sheet, SheetContent } from './ui/sheet.tsx'

// The decision history of a task, behind the clock icon in the thread header. B3 only needs the
// sheet to open and close accessibly (Radix: focus trap, Escape, focus return, a titled dialog
// and a Close button); the entries and Reopen arrive with B6.
export default function HistorySheet({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        title="Decision history"
        description={`Decisions and hand-overs for ${task.title}. The chat is the conversation; this is the record.`}
      />
    </Sheet>
  )
}
```

### packages/web/src/components/ThreadView.tsx

```tsx
import { useEffect, useState } from 'react'
import type { Comment, Task } from '@kanban/shared'
import { emptyThreadText, readMoreId } from '../lib/messages.ts'
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
          emptyText={emptyThreadText(task, projectName)}
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

### packages/web/src/components/ThreadFooter.tsx

```tsx
import { DONE_VISIBLE_MS, isDone, type Task } from '@kanban/shared'
import {
  dayAndTime,
  daysUntilHidden,
  isDateable,
  quickReplies,
  type QuickReply,
} from '../lib/threads.ts'
import type { useReply } from '../lib/use-reply.ts'
import Composer from './Composer.tsx'
import QuickReplies from './QuickReplies.tsx'

// What replaces the composer on a finished task: when it finished and, while it is still in the
// lists, how long until it leaves them. Reopen is B6's.
function DoneNote({ task, now }: { task: Task; now: number }) {
  const at = task.doneAt
  const stamp = isDateable(at) ? ` ${dayAndTime(at, now)}` : ''
  const hidesIn = isDateable(at) && now - at < DONE_VISIBLE_MS ? daysUntilHidden(task, now) : null
  return (
    <p className="py-2 text-sm text-muted-foreground">
      {`Done${stamp}.`}
      {hidesIn !== null ? ` Gone from lists in ${hidesIn} d; still in History.` : ''}
    </p>
  )
}

// The bar pinned under the conversation: the quick replies while the task needs James (same
// chips as on Threads), then the composer, or the done note once the task is finished.
export default function ThreadFooter({
  task,
  now,
  reply,
  onQuickReply,
}: {
  task: Task
  now: number
  reply: ReturnType<typeof useReply>
  onQuickReply: (quick: QuickReply) => void
}) {
  return (
    <footer className="sticky bottom-0 z-(--z-raised) border-t border-border bg-card px-4 pt-2.5 pb-safe">
      <div className="flex flex-col gap-2 pb-3">
        <QuickReplies replies={quickReplies(task)} onReply={onQuickReply} className="pt-0 pl-0" />
        {isDone(task) ? (
          <DoneNote task={task} now={now} />
        ) : (
          <Composer
            text={reply.text}
            onText={reply.setText}
            canSend={reply.canSend}
            onSend={reply.send}
            failed={reply.failed}
          />
        )}
      </div>
    </footer>
  )
}
```

### packages/web/src/components/MessageList.tsx

```tsx
import type { ReactNode } from 'react'
import type { Comment } from '@kanban/shared'
import { messageShape } from '../lib/messages.ts'
import { JamesMessage, SessionMessage, SystemLine, Typing } from './Messages.tsx'

// The conversation, oldest first: quiet centred system lines, the session's messages on the
// left under their kind label, James's on the right with time and ticks, and the typing dots
// after the last one while the session works. Only the message `readMoreId` names carries Read
// more. An empty conversation says `emptyText`.
export default function MessageList({
  messages,
  now,
  readMoreId,
  working,
  emptyText,
  onReadMore,
}: {
  messages: Comment[]
  now: number
  readMoreId: string | null
  working: boolean
  emptyText: string
  onReadMore: () => void
}) {
  const view = (comment: Comment): ReactNode => {
    switch (messageShape(comment)) {
      case 'system':
        return <SystemLine key={comment.id} comment={comment} />
      case 'james':
        return <JamesMessage key={comment.id} comment={comment} now={now} />
      case 'session':
        return (
          <SessionMessage
            key={comment.id}
            comment={comment}
            now={now}
            readMore={comment.id === readMoreId}
            onReadMore={onReadMore}
          />
        )
    }
  }
  return (
    <div role="log" aria-label="Conversation" className="flex flex-col gap-3 py-3">
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : null}
      {messages.map(view)}
      {working ? <Typing /> : null}
    </div>
  )
}
```

### packages/web/src/components/DoneList.tsx

```tsx
import { useState } from 'react'
import type { Task } from '@kanban/shared'
import { EmptyNote } from './ScreenState.tsx'
import { DoneTaskCard } from './TaskCards.tsx'
import { Button } from './ui/button.tsx'

// The Done tab: what finished within the window, then, when there is more, a button that
// reveals (and hides again) the older ones below. Both lists arrive newest finish first.
export default function DoneList({
  recent,
  older,
  now,
}: {
  recent: Task[]
  older: Task[]
  now: number
}) {
  const [showOlder, setShowOlder] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      {recent.length === 0 ? <EmptyNote>Nothing finished this week.</EmptyNote> : null}
      <ul className="flex flex-col gap-3">
        {recent.map((task) => (
          <DoneTaskCard key={task.id} task={task} now={now} />
        ))}
      </ul>
      {older.length > 0 ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => setShowOlder((shown) => !shown)}
        >
          {`${showOlder ? 'Hide' : 'Show'} ${older.length} older`}
        </Button>
      ) : null}
      {showOlder ? (
        <ul className="flex flex-col gap-3">
          {older.map((task) => (
            <DoneTaskCard key={task.id} task={task} now={now} />
          ))}
        </ul>
      ) : null}
    </div>
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

### packages/web/src/components/SpecDecision.tsx

```tsx
import { useId, useState } from 'react'
import type { Task, TaskSpec } from '@kanban/shared'
import { approveSpec, requestChange } from '../data.ts'
import { MAX_COMMENT_CHARS } from '../lib/limits.ts'
import { specVersion } from '../lib/threads.ts'
import { useDecision } from '../lib/use-decision.ts'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Textarea } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { SheetContent } from './ui/sheet.tsx'

// What the spec says: goal, points, out of scope, touches. A task whose spec has not arrived
// yet (or is half-migrated) says so instead of showing an empty card.
function SpecBody({ spec }: { spec: TaskSpec | null }) {
  if (!spec) return <p>The session hasn't attached the spec yet.</p>
  const points = Array.isArray(spec.points) ? spec.points : []
  return (
    <div className="flex flex-col gap-2 text-base leading-relaxed">
      <p>
        <strong>Goal.</strong> {spec.goal}
      </p>
      {points.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {points.map((point, index) => (
            <li key={`${index}:${point}`}>{point}</li>
          ))}
        </ul>
      ) : null}
      {spec.out ? (
        <p>
          <strong>Out of scope.</strong> {spec.out}
        </p>
      ) : null}
      {spec.touches ? (
        <p className="text-sm text-muted-foreground">
          <strong>Touches:</strong> {spec.touches}
        </p>
      ) : null}
    </div>
  )
}

// The free text of a change request.
function ChangeBox({ text, onText }: { text: string; onText: (text: string) => void }) {
  const boxId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={boxId}>What should change?</Label>
      <Textarea
        id={boxId}
        rows={3}
        maxLength={MAX_COMMENT_CHARS}
        placeholder="e.g. Also add a totals row at the bottom"
        value={text}
        onChange={(event) => onText(event.target.value)}
      />
    </div>
  )
}

// The spec decision: Approve vN, or Changes… with free text that goes to the session.
export default function SpecDecision({
  task,
  mode,
  close,
  returnFocus,
}: {
  task: Task
  mode: 'read' | 'change'
  close: () => void
  returnFocus: (event: Event) => void
}) {
  const [changing, setChanging] = useState(mode === 'change')
  const [text, setText] = useState('')
  const { pending, failed, decide } = useDecision(task.id, close)
  const version = specVersion(task)

  return (
    <SheetContent
      onCloseAutoFocus={returnFocus}
      title={`Spec v${version} — ${task.title}`}
      aria-describedby={undefined}
    >
      <div className="flex flex-col gap-4">
        <SpecBody spec={task.spec} />
        {changing ? <ChangeBox text={text} onText={setText} /> : null}
        <SaveError failed={failed} />
        <div className="flex gap-2.5">
          {changing ? (
            <>
              <Button
                className="flex-1"
                disabled={pending || text.trim() === ''}
                onClick={() => void decide('request_change', () => requestChange(task, text))}
              >
                Send to session
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setChanging(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                className="flex-1"
                disabled={pending}
                onClick={() => void decide('approve_spec', () => approveSpec(task))}
              >
                Approve v{version}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setChanging(true)}
              >
                Changes…
              </Button>
            </>
          )}
        </div>
      </div>
    </SheetContent>
  )
}
```

### packages/web/src/pages/Thread.tsx

```tsx
import { useParams } from 'react-router-dom'
import { isDone } from '@kanban/shared'
import { useAgents, useProjects, useTask, useTaskComments } from '../data.ts'
import ThreadView from '../components/ThreadView.tsx'
import { ThreadFailed, ThreadGone, ThreadLoading } from '../components/ThreadState.tsx'
import { liveProjectIds } from '../lib/projects.ts'
import { useNow } from '../lib/use-now.ts'

// /t/:taskId — one task as a conversation. Only the task and its comments gate the screen; the
// project name and "session live" come from reads that, if they fail, just leave the header
// without them (data.ts logs the failure).
export default function Thread() {
  const { taskId } = useParams()
  const now = useNow()
  const task = useTask(taskId)
  const comments = useTaskComments(taskId)
  const projects = useProjects()
  const agents = useAgents()

  const failed = [task, comments].filter((source) => source.error !== null)
  if (failed.length > 0) return <ThreadFailed failed={failed} />
  if (task.loading || comments.loading) return <ThreadLoading />
  if (!task.data) return <ThreadGone />

  const shown = task.data
  const live = !isDone(shown) && liveProjectIds(agents.data, now).has(shown.projectId)
  return (
    <ThreadView
      key={shown.id}
      task={shown}
      comments={comments.data}
      projectName={projects.data.find((p) => p.id === shown.projectId)?.name ?? null}
      live={live}
      now={now}
    />
  )
}
```

### packages/web/src/pages/Project.tsx

```tsx
import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Project as ProjectDoc, Task, Todo } from '@kanban/shared'
import { useAgents, useProject, useProjectTasks, useProjectTodos } from '../data.ts'
import DoneList from '../components/DoneList.tsx'
import LiveList from '../components/LiveList.tsx'
import PageHeader from '../components/PageHeader.tsx'
import Screen from '../components/Screen.tsx'
import { EmptyNote, LoadFailed, LoadingStatus } from '../components/ScreenState.tsx'
import TodoList from '../components/TodoList.tsx'
import { Button } from '../components/ui/button.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { Plus } from '../lib/icons.ts'
import { doneTasks, hostLine, liveProjectIds, liveTasks, orderTodos } from '../lib/projects.ts'
import { useProjectTab } from '../lib/use-project-tab.ts'
import { useNow } from '../lib/use-now.ts'

const BACK = { to: '/projects', label: 'Back to projects' }

// A project's three tabs for one loaded project: Live (in flight, James's turn first), For James
// (hand-done items) and Done (this week, older behind a button). The tab lives in the URL.
function ProjectView({
  project,
  tasks,
  todos,
  live,
  now,
}: {
  project: ProjectDoc
  tasks: Task[]
  todos: Todo[]
  live: boolean
  now: number
}) {
  const [tab, choose] = useProjectTab()
  const inFlight = useMemo(() => liveTasks(tasks), [tasks])
  const done = useMemo(() => doneTasks(tasks, now), [tasks, now])
  const tabs = [
    { id: 'live', label: `Live · ${inFlight.length}` },
    { id: 'james', label: `For James · ${todos.filter((todo) => !todo.done).length}` },
    { id: 'done', label: `Done · ${done.recent.length}` },
  ] as const

  return (
    <Screen
      header={
        <PageHeader
          title={project.name}
          sub={hostLine(project.hostname, live)}
          back={BACK}
          right={<AddTaskLink projectId={project.id} />}
        >
          <Segmented label="Project tabs" options={tabs} value={tab} onChange={choose} />
        </PageHeader>
      }
    >
      <div className="px-4">
        {tab === 'live' ? <LiveList tasks={inFlight} /> : null}
        {tab === 'james' ? <TodoList projectId={project.id} todos={orderTodos(todos)} /> : null}
        {tab === 'done' ? <DoneList recent={done.recent} older={done.older} now={now} /> : null}
      </div>
    </Screen>
  )
}

// The "+ Task" button: New task with this project preselected.
function AddTaskLink({ projectId }: { projectId: string }) {
  return (
    <Button asChild>
      <Link to={`/new?project=${encodeURIComponent(projectId)}`}>
        <Plus aria-hidden="true" />
        Task
      </Link>
    </Button>
  )
}

// A header with only the way back, for the states before there is a project to show.
function BareScreen({ children }: { children: ReactNode }) {
  return <Screen header={<PageHeader title="Project" back={BACK} />}>{children}</Screen>
}

// /p/:projectId — one project. The project, its tasks and its todos gate the screen; a failed
// agents read only costs the live line (data.ts logs it).
export default function Project() {
  const { projectId } = useParams()
  const now = useNow()
  const project = useProject(projectId)
  const tasks = useProjectTasks(projectId)
  const todos = useProjectTodos(projectId)
  const agents = useAgents()

  const failed = [project, tasks, todos].filter((source) => source.error !== null)
  if (failed.length > 0)
    return (
      <BareScreen>
        <LoadFailed title="Couldn't load this project" failed={failed} />
      </BareScreen>
    )
  if ([project, tasks, todos, agents].some((source) => source.loading))
    return (
      <BareScreen>
        <LoadingStatus label="Loading project" />
      </BareScreen>
    )
  if (!project.data)
    return (
      <BareScreen>
        <EmptyNote>This project no longer exists.</EmptyNote>
      </BareScreen>
    )
  return (
    <ProjectView
      key={project.data.id}
      project={project.data}
      tasks={tasks.data}
      todos={todos.data}
      live={liveProjectIds(agents.data, now).has(project.data.id)}
      now={now}
    />
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

### tests/fixtures/web-threads-b4.tsx

```tsx
// Shared fixture for the web-threads B4 suites (the decision sheet). Builds on the B2 and B3
// fixtures: same task builder, board, thread sources, action spies and logger spy. Adds the B4
// data.ts writes (requestChange, tickStep), one task per kind of need, and a way to mount the
// real DecisionSheet on its own with an onClose spy (inside a router, like the app). The suite
// passes the sheet in: this module is loaded by the data.ts mock, so it must not import the app.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B4)).dataModule())
// DecisionSheet is never mocked here: it is the screen under test.
import { vi, type Mock } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Task } from '../../packages/shared/src/index.ts'
import { actions, logSpy, makeTask } from './web-threads-b2.tsx'
import { dataModule as b3DataModule, setThread } from './web-threads-b3.tsx'

// ---- tasks, one per kind of need ------------------------------------------------------

export const specTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Add search',
    stage: 'spec',
    needs: { kind: 'spec' },
    spec: {
      goal: 'Find any task by its title',
      points: ['A search box above the list', 'Matches as you type'],
      out: 'Searching comments',
      touches: 'Threads screen',
      version: 3,
    },
    ...over,
  })

export const questionTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Pick a font',
    stage: 'build',
    needs: {
      kind: 'question',
      question: 'Which font should we use?',
      options: [
        { key: 'A', label: 'Inter' },
        { key: 'B', label: 'Atkinson' },
      ],
    },
    ...over,
  })

export const prTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Fix the header',
    type: 'bugfix',
    stage: 'pr',
    needs: { kind: 'pr' },
    pr: { number: 42, url: 'https://github.com/nullnoise/kanban/pull/42' },
    summary: 'Header no longer overlaps the list on small phones.',
    ...over,
  })

export const STEPS = ['Open the site on your phone', 'Check the logs are quiet']
export const afterDeployTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Ship the footer',
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: STEPS,
    afterDone: [false, false],
    ...over,
  })

// ---- mocked data.ts (B2 + B3 + the B4 writes) ------------------------------------------

const resolved = () => Promise.resolve()

export const b4Actions = {
  requestChange: vi.fn((_task: Task, _text: string) => Promise.resolve()),
  tickStep: vi.fn((_task: Task, _index: number) => Promise.resolve()),
}

export const dataModule = () => ({
  ...b3DataModule(),
  ...b4Actions,
})

// Every write the sheet can make, for "no side effects" checks.
export const writeSpies = (): Mock[] => [
  actions.approveSpec,
  actions.answerQuestion,
  actions.markMerged,
  b4Actions.requestChange,
  b4Actions.tickStep,
]
export const writeCount = () => writeSpies().reduce((n, spy) => n + spy.mock.calls.length, 0)

// Loads the task as the thread's and the board's only task, and resets every write spy to a
// write that succeeds.
export function setSheetTask(task: Task | null) {
  setThread(task)
  for (const spy of writeSpies()) {
    spy.mockReset()
    spy.mockImplementation(resolved)
  }
}

// ---- mounting the real sheet ------------------------------------------------------------

export type SheetComponent = ComponentType<{
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}>

// The real DecisionSheet with an onClose spy. `rerender(next)` feeds the sheet a new snapshot
// of the task, the way the parent screens do.
export function renderSheet(
  DecisionSheet: SheetComponent,
  task: Task,
  mode: 'read' | 'change' = 'read'
) {
  setSheetTask(task)
  const onClose = vi.fn()
  const view = (t: Task) => (
    <MemoryRouter>
      <DecisionSheet task={t} mode={mode} onClose={onClose} />
    </MemoryRouter>
  )
  const result = render(view(task))
  return {
    onClose,
    user: userEvent.setup(),
    rerender: (next: Task) => result.rerender(view(next)),
  }
}

// ---- reading the sheet ------------------------------------------------------------------

export const dialog = () => screen.getByRole('dialog')
export const inDialog = () => within(dialog())
export const sheetText = () => (dialog().textContent ?? '').replace(/\s+/g, ' ')
export const SAVE_ERROR = /Couldn.t save\. Try again\./

// The user_action events with this action, as logged through `track`.
export const userActions = (action: string) =>
  logSpy.event.mock.calls.filter(
    (call) => call[0] === 'user_action' && (call[1] as { action?: string }).action === action
  )

// The api_call_failed errors logged for this action.
export const failures = (action: string) =>
  logSpy.error.mock.calls.filter(
    (call) =>
      call[0] === 'api_call_failed' &&
      (call[2] as { action?: string } | undefined)?.action === action
  )

// The request id of the one user_action logged for `action`.
export function tapRequestId(action: string): unknown {
  const taps = userActions(action)
  if (taps.length !== 1) throw new Error(`expected one ${action} tap, saw ${taps.length}`)
  return (taps[0][1] as { request_id?: unknown }).request_id
}

export { actions, logSpy }
```

### tests/fixtures/web-threads-b5.tsx

```tsx
// Shared fixture for the web-threads B5 suites (Projects, a project, New task). Builds on the B2,
// B3 and B4 fixtures: same task and todo builders, board, thread sources, action spies and logger
// spy. Adds the B5 data.ts names (useProject, useProjectTasks, useProjectTodos, createTask,
// toggleTodo, addTodo), projects with distinct hosts, agents, and a router that mounts the
// screens under test on their own routes. The suite passes the screens in: this module is loaded
// by the data.ts mock, so it must not import the app.
//
// The project-scoped hooks are views of the same sources as the board-wide ones (a project's
// tasks are board.tasks for that project, its todos the open and done todos given to setB5Board),
// sharing their loading, error and retry. So a screen reads consistent data whichever of the
// contract's hooks it uses, and a test that fails one source fails it everywhere.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B5)).dataModule())
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  AGENT_STALE_MS,
  DONE_VISIBLE_MS,
  type AgentDoc,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '../../packages/shared/src/index.ts'
import { DAY, MINUTE, NOW, board, live, setBoard, type LiveStub } from './web-threads-b2.tsx'
import { dataModule as b4DataModule } from './web-threads-b4.tsx'

// ---- projects and agents ------------------------------------------------------------------

const project = (id: string, name: string, hostname: string): Project => ({
  id,
  hostname,
  cwd: `C:/code/${name}`,
  name,
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
})

// In the order useProjects returns them (most recently updated first), deliberately not
// alphabetical. Ids match the B2 builders' defaults (makeTask / makeTodo use p-kanban).
export const B5_PROJECTS: Project[] = [
  project('p-kanban', 'kanban', 'desk-pc'),
  project('p-site', 'website', 'laptop'),
  project('p-cal', 'calendar', 'studio-mac'),
]

// An agent of `projectId` whose last heartbeat was `ago` ms before NOW (online while `ago` is
// under AGENT_STALE_MS).
export const agent = (id: string, projectId: string, ago: number): AgentDoc => ({
  id,
  projectId,
  hostname: 'desk-pc',
  cwd: `C:/code/${projectId}`,
  pid: 1234,
  claudeSessionId: null,
  startedAt: NOW - DAY,
  lastSeen: NOW - ago,
})
// Heartbeat ages derived from the shared window, so they hold whatever AGENT_STALE_MS is: well
// inside it, and just past it.
export const ONLINE = Math.floor(AGENT_STALE_MS / 3)
export const STALE = AGENT_STALE_MS + 1_000

// doneAt ages around the "this week" window (DONE_VISIBLE_MS): just inside it, just outside it,
// and `days` past it.
export const JUST_INSIDE_WEEK = DONE_VISIBLE_MS - MINUTE
export const JUST_OUTSIDE_WEEK = DONE_VISIBLE_MS + MINUTE
export const pastWeek = (days: number) => DONE_VISIBLE_MS + days * DAY

// ---- mocked data.ts (B2 + B3 + B4 + the B5 names) -------------------------------------------

export interface NewTaskInput {
  type: TaskType
  title: string
  description: string
  afterDeploy: string[]
}

export const NEW_TASK_ID = 't-new'
const created = (_projectId: string, _input: NewTaskInput) => Promise.resolve(NEW_TASK_ID)
const resolved = () => Promise.resolve()

export const b5Actions = {
  createTask: vi.fn(created),
  toggleTodo: vi.fn((_todo: Todo) => Promise.resolve()),
  addTodo: vi.fn((_projectId: string, _body: string) => Promise.resolve()),
}

// A save that never settles (offline, or a slow network).
export const pendingCreate = () => new Promise<string>(() => {})

// Every todo, open and done (useOpenTodos gets the open ones through board.todos).
let allTodos: Todo[] = []

// Loads the board (everything loaded, no errors) and resets every spy; the B5 writes go back
// to succeeding (createTask resolves with NEW_TASK_ID).
export function setB5Board(
  next: { tasks?: Task[]; todos?: Todo[]; projects?: Project[]; agents?: AgentDoc[] } = {}
) {
  const todos = next.todos ?? []
  setBoard({
    tasks: next.tasks ?? [],
    todos: todos.filter((t) => !t.done),
    projects: next.projects ?? B5_PROJECTS,
  })
  board.agents = live(next.agents ?? [])
  allTodos = todos
  b5Actions.createTask.mockReset()
  b5Actions.createTask.mockImplementation(created)
  b5Actions.toggleTodo.mockReset()
  b5Actions.toggleTodo.mockImplementation(resolved)
  b5Actions.addTodo.mockReset()
  b5Actions.addTodo.mockImplementation(resolved)
}

// A project-scoped view of a board source: same loading, error and retry; the data narrowed.
// Memoised per source and id so a screen sees stable values across renders, as with the real
// hooks (which keep their snapshot in state).
const views = new WeakMap<object, Map<string, LiveStub<unknown>>>()
function view<T>(source: LiveStub<unknown>, id: string, data: () => T): LiveStub<T> {
  let byId = views.get(source)
  if (!byId) {
    byId = new Map()
    views.set(source, byId)
  }
  if (!byId.has(id))
    byId.set(id, {
      data: data(),
      loading: source.loading,
      error: source.error,
      retry: source.retry,
    })
  return byId.get(id) as LiveStub<T>
}

export const dataModule = () => ({
  ...b4DataModule(),
  useProject: (id: string | undefined): LiveStub<Project | null> =>
    view(board.projects, id ?? '', () => board.projects.data.find((p) => p.id === id) ?? null),
  useProjectTasks: (id: string | undefined): LiveStub<Task[]> =>
    view(board.tasks, id ?? '', () => board.tasks.data.filter((t) => t.projectId === id)),
  useProjectTodos: (id: string | undefined): LiveStub<Todo[]> =>
    view(board.todos, id ?? '', () => allTodos.filter((t) => t.projectId === id)),
  ...b5Actions,
})

// ---- rendering ------------------------------------------------------------------------------

function WhereAmI() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

// Mounts each element on its route path (e.g. { '/projects': <Projects /> }); `/` defaults to a
// Threads placeholder and any other path to "elsewhere". The probe prints the URL (read it with
// the B2 fixture's `where`).
export function renderB5(path: string, routes: Record<string, ReactNode>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {Object.entries(routes).map(([at, element]) => (
          <Route key={at} path={at} element={element} />
        ))}
        {'/' in routes ? null : <Route path="/" element={<h1>Threads home</h1>} />}
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <WhereAmI />
    </MemoryRouter>
  )
}

// ---- reading the screen ---------------------------------------------------------------------

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// An element's text as a reader gets it: its text nodes joined by a space (textContent would glue
// neighbours, "2" + "live" → "2live"), skipping form fields' contents and the location probe.
export function textIn(root: Node): string {
  const parts: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('textarea, select, [data-testid="location"]')) continue
    parts.push(node.textContent ?? '')
  }
  return norm(parts.join(' '))
}
export const b5Text = () => textIn(document.body)

// True when `text` contains `phrase` as a whole count ("2 live" but not "12 live").
export const hasPhrase = (text: string, phrase: string) =>
  new RegExp(`(^|[^\\w])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w])`).test(text)

// The item around `el`: its largest ancestor that holds no other element matching `selector`
// (so a card's link, a todo's checkbox, ...). Needs at least two such elements on screen.
export function itemOf(el: HTMLElement, selector: string): HTMLElement {
  let item = el
  while (item.parentElement && item.parentElement.querySelectorAll(selector).length === 1)
    item = item.parentElement
  return item
}

export const linksTo = (prefix: string) =>
  screen
    .queryAllByRole('link')
    .filter((a) => (a.getAttribute('href') ?? '').startsWith(prefix)) as HTMLAnchorElement[]
export const hrefsTo = (prefix: string) => linksTo(prefix).map((a) => a.getAttribute('href'))

// A project's card on Projects (its link to /p/<id>) and the card's text.
export function projectCard(id: string): HTMLElement {
  const link = linksTo(`/p/${id}`)
  if (link.length !== 1) throw new Error(`expected one link to /p/${id}, saw ${link.length}`)
  return itemOf(link[0], 'a[href^="/p/"]')
}
export const projectCardText = (id: string) => textIn(projectCard(id))

// A task's card on a project's Live or Done tab (its link to /t/<id>).
export function taskCard(id: string): HTMLElement {
  const link = linksTo(`/t/${id}`)
  if (link.length !== 1) throw new Error(`expected one link to /t/${id}, saw ${link.length}`)
  return itemOf(link[0], 'a[href^="/t/"]')
}

// The project's tabs and the New task type buttons: the buttons that expose aria-pressed.
export const pressable = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
export function tab(label: string): HTMLElement {
  const found = pressable().find((b) => textIn(b).startsWith(label))
  if (!found) throw new Error(`no tab starting with "${label}"`)
  return found
}
export const tabLabel = (label: string) => textIn(tab(label))

// Every focusable control on the page (the B2/B3 keyboard suites' definition).
export const controls = () =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]'
    )
  ).filter((el) => el.getAttribute('tabindex') !== '-1')

export const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled
```

### tests/fixtures/web-threads-b4-emulator.ts

```tsx
// Shared setup for the web-threads B4 emulator suites (tests/emulator/web-threads-b4-*.test.ts):
// the real packages/web/src/data.ts writing to the Firestore emulator as James, under the real
// firestore.rules, with firebase.ts pointed at that emulator database and the logger stubbed.
// Run with `npm run test:rules` (project demo-kanban); never against a live project.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../../packages/web/src/firebase.ts', async () =>
//     (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule())
//   vi.mock('../../packages/web/src/lib/log.ts', async () =>
//     (await import('../fixtures/web-threads-b4-emulator.ts')).logModule())
// then calls useEmulator() inside its describe blocks.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, expect, vi } from 'vitest'
import {
  LOG_CAP,
  initialTaskFields,
  type Comment,
  type LogEntry,
  type Task,
} from '../../packages/shared/src/index.ts'

const state = { env: null as RulesTestEnvironment | null, db: null as Firestore | null }

// firebase.ts as the app sees it, with `db` resolved when a write runs (after beforeAll).
export const firebaseModule = () => ({
  app: {},
  auth: {},
  get db() {
    return state.db
  },
})
export const logModule = () => ({
  log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
})

// Starts the emulator test environment once per file and empties the database before each test.
export function useEmulator() {
  beforeAll(async () => {
    state.env = await initializeTestEnvironment({
      projectId: 'demo-kanban',
      firestore: {
        rules: readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
    state.db = state.env
      .authenticatedContext('james-uid', { email: 'j@nullnoise.ai', email_verified: true })
      .firestore() as unknown as Firestore
  })
  afterAll(async () => {
    await state.env?.cleanup()
    state.env = null
    state.db = null
  })
  beforeEach(async () => {
    await state.env?.clearFirestore()
  })
}

// The database James's writes go to (the same one data.ts uses).
export function jamesDb(): Firestore {
  if (!state.db) throw new Error('useEmulator() has not started the emulator')
  return state.db
}

// ---- seeding ------------------------------------------------------------------------------

// A moment safely in the past, so a write's "now" is always later.
export const T0 = 1_700_000_000_000

// A complete task in the shared initial shape; overrides win. `id` is not stored.
export function makeTask(id: string, over: Partial<Task> = {}): Task {
  const base = initialTaskFields({
    projectId: over.projectId ?? 'p1',
    type: over.type ?? 'feature',
    title: over.title ?? `Task ${id}`,
    description: '',
    createdBy: 'james',
    afterDeploy: over.afterDeploy ?? [],
    now: T0,
  })
  return { ...base, agentId: 'agent-1', ...over, id }
}

// Writes the task (without its id) with the rules out of the way; returns it as the screen has it.
export async function seedTask(task: Task): Promise<Task> {
  const { id, ...stored } = task
  if (!state.env) throw new Error('useEmulator() has not started the emulator')
  await state.env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'tasks', id), stored)
  })
  return task
}

// `count` history entries, oldest first: "Entry 0", "Entry 1", ...
export const historyOf = (count: number): LogEntry[] =>
  Array.from({ length: count }, (_, i) => ({ at: T0 + i, who: 'session', text: `Entry ${i}` }))

export const FULL_LOG = () => historyOf(LOG_CAP)

// ---- reading back (as James, through the rules) --------------------------------------------

export async function readTask(id: string): Promise<Omit<Task, 'id'>> {
  const snap = await getDoc(doc(jamesDb(), 'tasks', id))
  if (!snap.exists()) throw new Error(`task ${id} is gone`)
  return snap.data() as Omit<Task, 'id'>
}

export async function readComments(taskId: string): Promise<Comment[]> {
  const snap = await getDocs(
    query(collection(jamesDb(), 'comments'), where('taskId', '==', taskId))
  )
  return snap.docs
    .map((d) => ({ ...(d.data() as Comment), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// The archived history entries of a task, oldest first.
export async function readArchive(taskId: string): Promise<LogEntry[]> {
  const snap = await getDocs(collection(jamesDb(), 'tasks', taskId, 'log_archive'))
  return snap.docs.map((d) => d.data() as LogEntry).sort((a, b) => a.at - b.at)
}

// The newest history entry.
export const lastEntry = (task: Pick<Task, 'log'>): LogEntry | undefined =>
  task.log[task.log.length - 1]

// What the task document holds, as seeded (the id is not stored).
export const stored = (task: Task): Omit<Task, 'id'> => {
  const { id: _id, ...rest } = task
  return rest
}

// Nothing was written: the task is as seeded, with no message and no archive.
export async function expectUntouched(task: Task) {
  expect(await readTask(task.id)).toEqual(stored(task))
  expect(await readComments(task.id)).toEqual([])
  expect(await readArchive(task.id)).toEqual([])
}

export { LOG_CAP }
```

### tests/fixtures/web-threads-b5-emulator.ts

```tsx
// Shared helpers for the web-threads B5 emulator suites (tests/emulator/web-threads-b5-*.test.ts).
// Builds on the B4 emulator fixture, which owns the emulator lifecycle (useEmulator), the mocked
// firebase.ts and logger, and the task read-backs; this adds the todo and whole-collection
// read-backs B5's writes need. Everything is read and seeded as James, through the real rules
// (James may write todos and projects). Run with `npm run test:rules` (project demo-kanban).
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import type { Project, Task, Todo } from '../../packages/shared/src/index.ts'
import { T0, jamesDb } from './web-threads-b4-emulator.ts'

export const makeTodo = (id: string, over: Partial<Todo> = {}): Todo => ({
  id,
  projectId: 'p1',
  body: `Todo ${id}`,
  link: null,
  done: false,
  sourceTaskId: null,
  createdAt: T0,
  doneAt: null,
  ...over,
})

export async function seedTodo(todo: Todo): Promise<Todo> {
  await setDoc(doc(jamesDb(), 'todos', todo.id), todo)
  return todo
}

export async function seedProject(id: string): Promise<Project> {
  const project: Project = {
    id,
    hostname: 'desk-pc',
    cwd: `C:/code/${id}`,
    name: id,
    createdAt: T0,
    updatedAt: T0,
  }
  await setDoc(doc(jamesDb(), 'projects', id), project)
  return project
}

// Every todo, by document id, oldest first.
export async function readTodos(): Promise<Todo[]> {
  const snap = await getDocs(collection(jamesDb(), 'todos'))
  return snap.docs
    .map((d) => ({ ...(d.data() as Todo), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// Every task, by document id.
export async function readTasks(): Promise<Task[]> {
  const snap = await getDocs(collection(jamesDb(), 'tasks'))
  return snap.docs.map((d) => ({ ...(d.data() as Task), id: d.id }))
}
```

### tests/emulator/web-threads-b4-16.test.ts

```tsx
// web-threads B4, criterion 16, in the Firestore emulator (`npm run test:rules`): what
// approveSpec and requestChange store when James decides on a spec, read back as James through
// the real rules. Approve: stage build, need cleared, history "Approved spec v<N>", James's
// message kind approve "Approved.". Change request: need cleared, stage kept, history "Asked for
// a change to spec v<N>: <text>", message kind change_request "Change: <text>". Both are guarded
// transactions (a double tap or a stale screen writes nothing) and move history past LOG_CAP to
// tasks/{id}/log_archive.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  FULL_LOG,
  LOG_CAP,
  T0,
  expectUntouched,
  lastEntry,
  makeTask,
  readArchive,
  readComments,
  readTask,
  seedTask,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const SPEC = {
  goal: 'Find any task by its title',
  points: ['A search box'],
  out: 'Comments',
  touches: 'Threads',
  version: 3,
}
const specTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', { stage: 'spec', needs: { kind: 'spec' }, spec: SPEC, ...over })

describe('B4-16 approveSpec in the emulator', () => {
  useEmulator()

  it('moves to build, clears the need, records "Approved spec v<N>" and sends "Approved."', async () => {
    const task = await seedTask(specTask())
    const before = Date.now()
    await data.approveSpec(task)
    const after = Date.now()
    const stored = await readTask('t1')
    expect(stored.stage).toBe('build')
    expect(stored.needs).toBeNull()
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: 'Approved spec v3' })
    )
    expect(lastEntry(stored)?.at).toBeGreaterThanOrEqual(before)
    expect(lastEntry(stored)?.at).toBeLessThanOrEqual(after)
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        projectId: 'p1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'approve',
        body: 'Approved.',
        deliveredAt: null,
      })
    )
    expect(stored.updatedAt).toBeGreaterThan(T0)
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
  })

  it('approves from stage approved too', async () => {
    const task = await seedTask(specTask({ stage: 'approved' }))
    await data.approveSpec(task)
    const stored = await readTask('t1')
    expect(stored.stage).toBe('build')
    expect(lastEntry(stored)?.text).toBe('Approved spec v3')
  })

  it('records v1 when the task has no spec', async () => {
    const task = await seedTask(specTask({ spec: null }))
    await data.approveSpec(task)
    expect(lastEntry(await readTask('t1'))?.text).toBe('Approved spec v1')
    expect((await readComments('t1'))[0].body).toBe('Approved.')
  })

  it('keeps the earlier history and appends to it', async () => {
    const earlier = [{ at: T0, who: 'session' as const, text: 'Spec v3 ready' }]
    const task = await seedTask(specTask({ log: earlier }))
    await data.approveSpec(task)
    const stored = await readTask('t1')
    expect(stored.log.map((e) => e.text)).toEqual(['Spec v3 ready', 'Approved spec v3'])
  })

  it('writes nothing when the need is not a spec', async () => {
    const task = await seedTask(specTask({ needs: { kind: 'question', question: 'Why?' } }))
    await data.approveSpec(task)
    await expectUntouched(task)
  })

  it('writes nothing outside stage spec or approved', async () => {
    const task = await seedTask(specTask({ stage: 'build' }))
    await data.approveSpec(task)
    await expectUntouched(task)
  })

  it('writes nothing from a stale screen (the need was already cleared)', async () => {
    const onScreen = specTask()
    const current = await seedTask(specTask({ needs: null }))
    await data.approveSpec(onScreen)
    await expectUntouched(current)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(specTask())
    await data.approveSpec(task)
    await data.approveSpec(task)
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(specTask({ log: FULL_LOG() }))
    await data.approveSpec(task)
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 1')
    expect(lastEntry(stored)?.text).toBe('Approved spec v3')
    const archive = await readArchive('t1')
    expect(archive).toHaveLength(1)
    expect(archive[0]).toEqual(expect.objectContaining({ at: T0, who: 'session', text: 'Entry 0' }))
  })
})

describe('B4-16 requestChange in the emulator', () => {
  useEmulator()

  it('clears the need, keeps the stage, records the text and sends "Change: <text>"', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, '  Search comments too  ')
    const stored = await readTask('t1')
    expect(stored.stage).toBe('spec')
    expect(stored.needs).toBeNull()
    expect(stored.spec).toEqual(SPEC)
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({
        who: 'james',
        text: 'Asked for a change to spec v3: Search comments too',
      })
    )
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        author: 'james',
        kind: 'change_request',
        body: 'Change: Search comments too',
      })
    )
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
  })

  it('works from stage approved and records v1 without a spec', async () => {
    const task = await seedTask(specTask({ stage: 'approved', spec: null }))
    await data.requestChange(task, 'Start over')
    const stored = await readTask('t1')
    expect(stored.stage).toBe('approved')
    expect(lastEntry(stored)?.text).toBe('Asked for a change to spec v1: Start over')
  })

  it('writes nothing for empty or whitespace-only text', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, '')
    await data.requestChange(task, '   \n ')
    await expectUntouched(task)
  })

  it('caps the text at 4000 characters', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, 'x'.repeat(5000))
    const [comment] = await readComments('t1')
    expect(comment.body.startsWith('Change: xxx')).toBe(true)
    expect(comment.body.length).toBeGreaterThanOrEqual(4000)
    expect(comment.body.length).toBeLessThanOrEqual('Change: '.length + 4000)
    const text = lastEntry(await readTask('t1'))?.text ?? ''
    expect(text.startsWith('Asked for a change to spec v3: xxx')).toBe(true)
    expect(text.length).toBeLessThanOrEqual('Asked for a change to spec v3: '.length + 4000)
  })

  it('writes nothing when the need is not a spec', async () => {
    const task = await seedTask(specTask({ needs: { kind: 'pr' }, stage: 'pr' }))
    await data.requestChange(task, 'Search comments too')
    await expectUntouched(task)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, 'Search comments too')
    await data.requestChange(task, 'Search comments too')
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(specTask({ log: FULL_LOG() }))
    await data.requestChange(task, 'Search comments too')
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 1')
    expect(lastEntry(stored)?.text).toBe('Asked for a change to spec v3: Search comments too')
    const archive = await readArchive('t1')
    expect(archive.map((e) => e.text)).toEqual(['Entry 0'])
  })
})
```

### tests/web-threads-b4-20.test.tsx

```tsx
// @vitest-environment jsdom
// web-threads B4, criterion 20: any decision sheet, while open, traps focus; Escape and the Close
// button dismiss it without side effects (no write, no decision logged) and the control that
// opened it regains focus. The real sheet is opened from the thread view and from Threads. The
// sheet also closes itself when the task no longer has the need it was opened for.
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { Task } from '../packages/shared/src/index.ts'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { MINUTE, NOW, installClock, logSpy, renderAt } from './fixtures/web-threads-b2.tsx'
import { b3Actions, renderThread, sessionMsg, thread } from './fixtures/web-threads-b3.tsx'
import {
  afterDeployTask,
  prTask,
  questionTask,
  renderSheet,
  setSheetTask,
  specTask,
  writeCount,
} from './fixtures/web-threads-b4.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b4.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const SPEC_TITLE = 'Spec v3 — Add search'
const sheet = () => screen.queryByRole('dialog')

// The spec thread, opened on its message's Read more (the sheet in mode read).
async function openFromThread(task: Task = specTask()) {
  setSheetTask(task)
  thread.comments.data = [sessionMsg('c1', 'spec', 'Here is the spec', NOW - 10 * MINUTE)]
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  const trigger = screen.getAllByRole('button', { name: 'Read more' })[0]
  await user.click(trigger)
  await screen.findByRole('dialog', { name: SPEC_TITLE })
  return { user, trigger }
}

// Threads with the after-deploy task, opened on its quick reply "Open the 2 steps".
async function openFromThreads() {
  setSheetTask(afterDeployTask())
  renderAt('/', <Threads />)
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Open the 2 steps' })
  await user.click(trigger)
  await screen.findByRole('dialog', { name: 'Deployed. Your steps:' })
  return { user, trigger }
}

// Nothing was decided: no write, no reply, no decision logged.
function expectNoSideEffects() {
  expect(writeCount()).toBe(0)
  expect(b3Actions.sendReply).not.toHaveBeenCalled()
  const decisions = logSpy.event.mock.calls.filter(
    (call) =>
      call[0] === 'user_action' &&
      ['approve_spec', 'request_change', 'answer', 'merged', 'tick_step', 'untick_step'].includes(
        String((call[1] as { action?: string }).action)
      )
  )
  expect(decisions).toEqual([])
}

async function expectTrapped(user: UserEvent, shift = false) {
  const dialog = screen.getByRole('dialog')
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
  for (let i = 0; i < 12; i++) {
    await user.tab({ shift })
    expect(dialog.contains(document.activeElement)).toBe(true)
  }
}

describe('B4-20 focus while a sheet is open', () => {
  installClock()

  it('keeps Tab inside the spec sheet', async () => {
    const { user } = await openFromThread()
    expect(screen.getByRole('button', { name: 'Approve v3' })).toBeTruthy()
    await expectTrapped(user)
  })

  it('keeps Shift+Tab inside the after-deploy sheet', async () => {
    const { user } = await openFromThreads()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await expectTrapped(user, true)
  })
})

describe('B4-20 dismissing a sheet', () => {
  installClock()

  it('Escape closes the spec sheet, writes nothing and focuses Read more again', async () => {
    const { user, trigger } = await openFromThread()
    expect(screen.getByRole('button', { name: 'Approve v3' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Close closes the spec sheet, writes nothing and focuses Read more again', async () => {
    const { user, trigger } = await openFromThread()
    expect(screen.getByRole('button', { name: 'Approve v3' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Escape with a change typed sends nothing', async () => {
    const { user, trigger } = await openFromThread()
    await user.click(screen.getByRole('button', { name: 'Changes…' }))
    await user.click(screen.getByRole('textbox', { name: 'What should change?' }))
    await user.keyboard('Search comments too')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Close on the after-deploy sheet ticks nothing and focuses Open the 2 steps again', async () => {
    const { user, trigger } = await openFromThreads()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Escape on the after-deploy sheet ticks nothing and focuses Open the 2 steps again', async () => {
    const { user, trigger } = await openFromThreads()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('B4-20 the sheet closes itself when its need is gone', () => {
  installClock()

  it.each([
    ['spec', specTask(), specTask({ stage: 'build', needs: null })],
    ['question', questionTask(), questionTask({ needs: null })],
    ['pr', prTask(), prTask({ stage: 'merged', needs: null })],
    ['spec → question', specTask(), specTask({ needs: { kind: 'question', question: 'Why?' } })],
  ])('the %s sheet calls onClose once the task has moved on', async (_name, before, after) => {
    const { onClose, rerender } = renderSheet(DecisionSheet, before)
    expect(onClose).not.toHaveBeenCalled()
    rerender(after)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeCount()).toBe(0)
  })
})
```

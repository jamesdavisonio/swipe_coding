# Feature: Rebuild the web app to the Threads prototype

**Status:** Spec confirmed (2026-11-02, James: "spec confirmed", recommendations 1–4 accepted)
**Date:** 2026-11-02
**Task class:** Large (six behaviours) with a Cross-cutting first step (data model → ADR 0003)

Source of truth for look and flow: `prototype/index.html` (interactive copy
https://claude.ai/artifact/G9eMLDsxFLp8S7bhxyC6uU), chosen 2026-11-02 after five mock-ups.
Design tokens and primitives: `docs/design-system.md`.

## What the user sees

James opens the PWA on his phone and lands on **Threads**: one row per task across all his
projects plus a pinned **For James** row per project, filtered by project chips that carry a
"needs you" count. Rows that need him sit on top with quick-reply chips (Approve spec ·
Small change… · the answer options · Open PR / Merged it · Open the N steps); **Read more**
slides a decision card up from the bottom with the full spec, question, PR summary or
after-deploy checklist. Opening a row shows the conversation as messages: the session's
four kinds of message (spec, question, PR ready, after-deploy ready, plus done/info),
his replies with delivery ticks (one = sent, two grey = received by the session, two
coloured + typing dots = the session is working on it, "handled" when it answered), and a
composer. **Projects** lists his folders with a live dot, and each project shows Live /
For James / Done tabs (done tasks leave the lists 7 days after finishing, "Show older"
brings them back). **New task** queues work for the next session in a project, with
optional after-deploy steps that add an "After deploy" stage. Every task keeps a
**decision history** (approvals, change requests, answers, merges, reopens, hand-overs)
behind a clock icon, and a finished task can be **reopened with a note** that goes to the
session. Light and dark follow the phone.

Nothing in this feature changes what sessions do; it reads and writes the new task shape
that the agent work (DESIGN.md Phase 2, packages 2–3) will produce. Until then a fresh
board simply shows empty states.

## Acceptance criteria

Grouped by behaviour; each group is one `implement-feature` run, in this order.

### B1 — Shared model (Cross-cutting; ADR 0003 first)

1. Given a task of type `feature` without after-deploy steps, when its stage list is
   derived, the list is `spec → approved → build → pr → merged → main_ci → done`; with
   after-deploy steps `after_deploy` sits before `done`; `bugfix` starts at `fix` instead
   of `spec → approved → build`; `chore` is `do → done`.
2. Given a done task with `doneAt` more than 7 days ago, when any list is computed with
   "show older" off, the task is excluded; with "show older" on, or when opened by id, it
   is shown.
3. Given James's comment, when it is created, its delivery state is `sent`; when the agent
   stamps `deliveredAt` it reads `delivered`; when `workingAt` is set `working`; when
   `handledAt` is set `handled` — and the derivation never goes backwards.
4. Given the Firestore rules, when James's signed-in browser writes the new fields
   (`stage`, `needs`, `afterDone`, `log`, `doneAt`, `reopenedAt`, comment kinds, todos),
   the write succeeds; when any other principal tries, it is refused; `agents` stays
   read-only from the browser.
5. Given existing Phase 1 documents (status/subtasks shape), when the new app reads them,
   it either renders them through a documented compatibility mapping or they are deleted
   before cut-over — decided in Open questions before B1 starts.

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

### B5 — Projects and New task

21. Given Projects, when it opens, each project shows name, host, a live dot when an agent
    is online (`agents.lastSeen` within the stale window), counts of live tasks and open
    For James items.
22. Given a project, when opened, tabs Live / For James / Done show: live = not done;
    For James = todos (add, tick, link out) newest first; Done = done within 7 days, with
    Show older revealing the rest, newest first.
23. Given New task, when James picks a project, type, title (required), description and
    optionally "I have steps to do after deploy" with one step per line, the preview shows
    the resulting stage list; Save creates a `queued` task bound to no agent, with
    `afterDeploy` set, a system message "Queued by you · waiting for a session in
    <project>", a history entry "Queued: <title> · N after-deploy steps", and returns to
    Threads with the new row visible.
24. Given a project with no live agent, when New task saves, the task is still queued
    (the next session announces it — existing agent behaviour).

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

### Cross-cutting

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

## Out of scope

- Anything the session does: writing specs, asking questions, marking PR ready, detecting
  merge / main CI, after-deploy hand-over, delivery `workingAt`/`handledAt` stamping,
  double-spawn fix, new agent tools (`kanban_submit_spec`, `kanban_pr_ready`,
  `kanban_log`) — DESIGN.md Phase 2 packages 2, 3, 5.
- Push notifications (FCM), the custom domain `kanban.nullnoise.ai`, deploy.
- Permission relay from the phone (package 6) and the headless runner (Phase 3).
- A manual light/dark toggle (the class exists; no UI for it yet).
- Editing or deleting sent messages; search; multi-user, roles, sharing.
- Desktop-specific layouts beyond the centred 560 px column.
- i18n (English only per profile).
- Migrating Phase 1 task data by script (see Open questions).

## Public contract and existing boundaries

**Observed baseline** (commit `44bb706`, `origin/setup/security`):

- `packages/shared/src/index.ts` — `Task { id, projectId, agentId, type, title, description,
status: queued|in_progress|waiting_on_james|blocked_on_permission|done|orphaned, summary,
prUrl, branch, createdBy, createdAt, updatedAt, subtasks[], openQuestion, lastCommentAt }`,
  `Comment { id, taskId, projectId, agentId, author: james|agent, kind:
comment|question|answer|system, body, createdAt, deliveredAt }`, `Todo`, `Project`,
  `AgentDoc { lastSeen }` + `isAgentOnline`, `projectIdFor`, numeric ms timestamps.
- `packages/shared/src/templates.ts` — `TASK_TEMPLATES`, `subtasksFor`, `forJamesTaskId`.
- `firestore.rules` — owner-only (`isOwner()`), `agents` read-only, comments create only
  with `author == 'james'`, default deny.
- `firestore.indexes.json` — comments(taskId, createdAt), comments(agentId, deliveredAt,
  createdAt), tasks(projectId, updatedAt desc), tasks(status, updatedAt desc),
  tasks(projectId, status, updatedAt desc), todos(projectId, done, createdAt).
- `packages/web/src/data.ts` — `useCollection`/`useDocument` over `onSnapshot`; writes
  `renameProject`, `createTask`, `setTaskStatus`, `addComment`, `approveSubtask`,
  `toggleTodo`, `addTodo`.
- Agent delivery: `Board.listenForJames` delivers `author == 'james'` comments and stamps
  `deliveredAt`; `kanban_ask` sets `openQuestion` and `status: waiting_on_james`.

**Selected new contract** (planner's choice within the confirmed prototype; recorded in
ADR 0003 by B1):

- `Stage = spec|approved|build|fix|do|pr|merged|main_ci|after_deploy|done`;
  `stagesFor(type, hasAfterDeploy)` in `packages/shared`.
- `Task` adds `stage: Stage`, `needs: { kind: spec|question|pr|after_deploy; question?:
string; options?: { key: string; label: string }[] } | null`, `spec: { goal; points[];
out; touches; version } | null`, `afterDeploy: string[]`, `afterDone: boolean[]`,
  `pr: { number; url } | null`, `summary`, `doneAt: number | null`, `reopenedAt: number |
null`, `unread: boolean` (session set, James clears), `working: boolean`,
  `log: { at; who: james|session|system; text }[]` (append-only, bounded by Firestore doc
  size — B1 states the cap and the overflow rule). `status` and `subtasks` are retired;
  `queued` is `stage === first stage && agentId == null`.
- `Comment.kind` becomes `comment|answer|approve|change_request|merged|reopen` for James
  and `spec|question|pr|after_deploy|done|info|system` for the session; delivery adds
  `workingAt`, `handledAt` (agent-written). The web derives tick state only.
- Transitions James owns, each a Firestore transaction guarded on the current stage so a
  double tap is a no-op: approve (`approved`/`spec` → `build`), merged (`pr` → `merged`),
  all after-deploy steps ticked (`after_deploy` → `done`), reopen (`done` → previous).
- Indexes: tasks(projectId, stage, updatedAt desc), tasks(projectId, doneAt desc), comments
  unchanged.

**B1 contract details fixed at test time** (planner decisions, 2026-11-02; exact signatures
in `.sdd-evidence/web-threads-b1/packet-test-author.md` and ADR 0003):

- `appendLog(log, entry)` counts after appending: 199 + 1 archives nothing, 200 + 1 archives
  the single oldest entry, an already-oversized log archives all overflow oldest-first; the
  input array is never mutated.
- `bugfix` with after-deploy steps is `fix → pr → merged → main_ci → after_deploy → done`;
  `chore` with after-deploy steps is `do → after_deploy → done` (New task allows steps on
  any type, criterion 23).
- `STAGE_LABEL` (spec Spec · approved Approved · build Build · fix Fix · do Do · pr PR ·
  merged Merged · main_ci Main CI · after_deploy After deploy · done Done) is part of the
  shared contract: the stepper (B3) and New task preview (B5) render it.
- `deliveryState` treats a missing stamp field exactly like `null` (older comment documents
  carry no `workingAt`/`handledAt`).
- Indexes: `tasks(projectId ASC, stage ASC, updatedAt DESC)` and `tasks(projectId ASC,
doneAt DESC)` (a single-field `doneAt` index is automatic; the Done tab queries per
  project); both `comments` composite indexes stay exactly as they are (delivery depends
  on `comments(agentId, deliveredAt, createdAt)`); the two `status` indexes go.
- Agent compat in B1: `kanban_subtask { key: 'spec', status: 'awaiting_approval' }` arms
  `needs.kind === 'spec'`; `status: 'done'` on a key advances `stage` past it;
  `kanban_update_task { status: 'done' }` sets `stage: 'done'`, `doneAt`, unbinds the
  agent; `status: 'in_progress'` clears `needs`. Replaced wholesale by the four-moment tools
  in DESIGN.md Phase 2 package 2.
- Comment kinds are restricted on create, and a browser `update` of a comment may not change
  its `author` or `kind` (editing sent messages stays out of scope; this only closes the
  impersonation path where a James comment is rewritten into a session kind).
- Criterion 2's "opened by id" clause is B3's: its thread-view tests must open `/t/:id`
  for a done task older than 7 days and render it.
- The live protocol test (`packages/agent/test/protocol.ts`) keeps its pre-existing
  100 ms poll loops against real Firestore; waiver recorded in `.sdd-evidence/web-threads-b1/`
  (it predates this spec and is not a vitest file).
- `stageIndex` is the position in `stagesFor(type, afterDeploy.length > 0)`, `-1` when the
  stage is not in that list (e.g. a bugfix at `spec`).
- `initialTaskFields` returns no retired keys (`status`, `subtasks`, `openQuestion`,
  `prUrl`, `branch`) and `lastCommentAt: null`; `isTaskVisible` defaults `now` to the
  current time; the agent's task brief carries `mine: true` for the calling session; a
  cleared need is the literal `null`, never a missing field.

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

**Unresolved:** none for B1 or B2 (open questions 1–4 answered at confirmation).

## Files & modules affected

- `packages/shared/src/index.ts`, `templates.ts` — new types, `stagesFor`, visibility and
  tick-state helpers (pure; unit-tested).
- `docs/decisions/0003-stage-model.md` — ADR for the model change (B1).
- `firestore.rules`, `firestore.indexes.json` — new fields/indexes; rules-lint stays green.
- `packages/web/src/data.ts` — hooks for threads, project tabs, todos; transactional writes.
- `packages/web/src/pages/{Threads,Thread,Projects,Project,NewTask}.tsx` — screens.
- `packages/web/src/components/{ThreadRow,QuickReplies,DecisionSheet,HistorySheet,
ReopenSheet,Ticks,StageStepper,BottomNav,ProjectChips}.tsx` — on `components/ui/*`.
- `packages/web/src/lib/icons.ts` — icons added as needed.
- `packages/web/src/App.tsx` — routes `/`, `/t/:id`, `/projects`, `/p/:id`, `/new`.
- `packages/agent/src/board.ts` — only if a read helper must understand the new shape to
  keep `kanban_list_tasks` working (compat, not new behaviour); otherwise untouched.
- `tests/` + `packages/web` component tests (vitest + Testing Library + jsdom, added in B2).
- `DESIGN.md` data model section — updated by `update-docs` in each ship.

## Principles that apply

- `io-validation` — James's inputs (reply, change text, note, task title, steps) are
  trimmed, non-empty where required and length-capped before write; documents read from
  Firestore pass a shape guard before render so a half-migrated task degrades to a visible
  "unknown stage" row, not a crash.
- `idempotency` — comment ids are generated client-side before write; stage transitions
  are transactions guarded on the expected current stage; ticking a step toggles by
  index.
- `traceability` — each write carries a `request_id` in its log context; the agent's
  delivery stamps let a reply be followed from tap to session.
- `observability` — all events through `logging/logger.browser.js` with taxonomy types
  (below); no `console.*` in product paths.
- `graceful-degradation` — Firestore offline persistence on; optimistic UI with revert on
  permanent failure; empty/loading/error states on every screen.
- `error-schema` — surfaced errors use `docs/error-schema.md` codes (`application_id:
kanban`).
- Not engaged: `ai-sandboxing`, `gating` (no AI), `rate-limiting` (single owner,
  Firestore quotas suffice), auth unchanged (owner-only rules).

## Instrumentation

All from `logging/taxonomy.json` (v6); `feature: 'web-threads'` on every row; emitted via
`logger.browser.js` (`source: web_client`, buffered until the client logging project exists).

| event_type          | severity | context keys                                                                                                                                                                                         | audience |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `session_start`     | INFO     | `feature`                                                                                                                                                                                            | internal |
| `session_end`       | INFO     | `feature`, `duration_s`                                                                                                                                                                              | internal |
| `user_action`       | INFO     | `feature`, `action` ∈ reply · approve_spec · request_change · answer · merged · tick_step · untick_step · reopen · queue_task · todo_add · todo_done · filter · open_thread, `target` = task/todo id | internal |
| `milestone_reached` | INFO     | `feature`, `milestone` ∈ task_done · task_reopened · task_queued, `target`                                                                                                                           | internal |
| `api_call_failed`   | ERROR    | `feature`, `target` = firestore, `action`, `status`                                                                                                                                                  | internal |
| `validation_failed` | WARNING  | `feature`, `field`, `action`                                                                                                                                                                         | internal |
| `feature_error`     | ERROR    | `feature`, `action`                                                                                                                                                                                  | internal |

No R3 proposal needed; nothing here falls outside the taxonomy.

## Task class reasoning

**Large** per `docs/WORKFLOW-TIERS.md`: six behaviours, cross-module (shared, web, rules).
B1 is **Cross-cutting** (DB shape and the comment kinds the agent will write) → ADR
`docs/decisions/0003-stage-model.md` first, then one Medium `implement-feature` per
behaviour B1 → B6 with full ceremony (independent tests, fidelity gate, red checkpoint,
tests read-only, fresh-context review). Never-downshift triggers present: new write paths
(transitions, todos, log) and a shared contract change — so no behaviour downshifts.
`pre-deploy-check` before the first deploy of the rebuilt app.

## Open questions

All resolved at confirmation (2026-11-02):

1. **Phase 1 data:** delete the Phase 1 tasks/comments on the live board before B1 cuts
   over; no compatibility mapping. (A `For James` todo reminds James to do the delete.)
2. **Question options:** sessions supply `needs.options` (key · label); the sheet always
   offers free text as well.
3. **History cap:** `log[]` capped at 200 entries on the task; the oldest roll into a
   `tasks/{id}/log_archive` subcollection (B1 defines the helper; B6 reads it on demand).
4. **Unread semantics:** per task.

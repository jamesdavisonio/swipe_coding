# Feature: To-dos in a drawer, not on the deck

**Status:** Drafting
**Date:** 2026-11-08
**Task class:** Medium (the deck module: a new drawer and the removal of the to-do card kind;
criteria 98–106, numbering continues from the voice-notes fix, 94–97). Supersedes the to-do card
of `swipe-deck.md` (the `todos` kind in criteria 42–47 and its "All done" action).
**Design:** the mock-up James approved on 2026-11-08,
https://claude.ai/artifact/Sd761LqAvSBgGHbPJEPjjT (the drawer and its button only; the rest of that
page is a sketch of the deck).

## Decision brief (spec)

Yes: Build the to-do drawer from the mock-up

### Where it came from

You asked on 8 November to move to-dos off the deck, and said the drawer in the mock-up was exactly right.

### Why it exists

To-dos are a list you work through, not a decision to swipe, and they crowd the deck's cards.

### What will change

The deck shows no to-do cards. A to-do button at the bottom left, with the number still open, opens a drawer from the bottom: one fold-out section per project, open to-dos first with tick boxes, ticked ones below. For example, tapping "Cut the uptime checks to 3 regions…" opens its full text, its link and "Mark done".

### Key assumptions

Ticked to-dos stay listed under each project's open ones, as in the mock-up. The flash you saw on the tapped row above the pop-up will not happen in the board.

### Out of scope

Threads' own to-do views, editing or deleting a to-do, and any change to how sessions add to-dos.

### What you're agreeing to

One build to a pull request; the deck's "All done" to-do card goes away.

## What the user sees

The deck has no to-do cards any more, and its count and overview no longer include them. At the
bottom left of the deck sits a to-do button (a list icon on the to-do tint) with a badge showing
how many to-dos are still open across all projects; with none open the badge is gone and the
button stays. Tapping it slides a sheet up from the bottom titled "To-dos", with a line such as
"7 to do across 3 projects" and a close button always visible at its top right. Inside, each
project with any to-do is a fold-out section showing its name, how many are open and how many are
done. Each to-do is a row with a tick box and the start of its text on one line. Open to-dos come
first, oldest first; ticked ones follow under a "Done" line, greyed and struck through, newest
first. Ticking moves a row down at once; unticking moves it back. Tapping a row's text opens a
dialog above the sheet with the project, how long ago it was added, the full text, the task it came
from, its link when it has one, and "Mark done" (or "Mark not done"); the dialog closes with its own
close button, by tapping outside it or with Escape, and the sheet stays open underneath. Escape or
tapping outside the sheet closes the sheet.

## Acceptance criteria

98. Given open to-dos exist, the deck builds no card for them: no card of kind `todos`, and the
    deck's count and overview count only the other cards.
99. The deck shows a button named "To-dos, <n> open" at the bottom left, with a badge <n> = the
    number of to-dos not done across all projects; with none open the badge is absent, the button
    is named "To-dos, none open" and still opens the drawer.
100.  Tapping the button opens a dialog titled "To-dos" from the bottom, with the line "<n> to do
      across <p> projects" (p = projects with at least one open to-do; "1 project" singular) and a
      "Close to-dos" button; focus moves into it. The close button, a tap on the backdrop and Escape
      close it and focus returns to the to-do button.
101.  The drawer lists one section per project that has at least one to-do (open or done), named by
      the project's name, with its open count (when above 0) and "<d> done". Projects with open
      to-dos come first, the one with the oldest open to-do first; the rest follow by name. A section
      with open to-dos starts expanded, one without starts collapsed; its header toggles it
      (`aria-expanded`).
102.  Within a section, open to-dos come first, oldest `createdAt` first; then a "Done" divider and
      the done ones, newest `doneAt` first, shown as done (checked box, struck-through text). Each
      row's text is on one line, cut with an ellipsis when long; its full text is its accessible name.
103.  Tapping a row's tick box toggles that to-do (the existing `toggleTodo` write: done with
      `doneAt`, or back to open with `doneAt: null`); the row moves to its new place and the counts,
      the badge and the line update. A failed write shows the row in its previous state again and
      logs the failure (`api_call_failed` or `feature_error`, as the deck's other writes do).
104.  Tapping a row's text opens a dialog above the sheet showing "<project> · <time ago>", the full
      text, "From: <task title>" when the to-do came from a task, its link (opening in a new tab,
      `rel` including `noreferrer`) when it has a web link, and a "Mark done" / "Mark not done"
      button that toggles it and closes the dialog. Its close button, a tap outside it and Escape
      close only the dialog; the sheet stays open and focus returns to the row's text button.
105.  While the to-do dialog is open, nothing of the sheet shows above it: the tapped row's focus
      ring and the browser's tap highlight are not drawn over the dialog or its backdrop (the dialog
      is the top layer, and the row's tap highlight is transparent).
106.  Every control in the drawer and dialog is a button or link with an accessible name, at least
      44px tall, with a visible focus ring; the sheet and the dialog are modal (`aria-modal`) and
      keep keyboard focus inside them while open.

## Out of scope

- Threads (`/threads`, a thread's "For James" list) and the project page's to-dos — unchanged.
- Adding, editing or deleting to-dos from the board; how sessions create them (`kanban_todo_for_james`).
- Hiding old done to-dos (they stay listed; the sections fold).
- The rest of the mock-up page (the card, the dock's other buttons).

## Public contract and existing boundaries

**Observed baseline** (main at `b976581`):

- `packages/web/src/lib/deck.ts`: `todoCards` builds one `todos` card per project (`id`
  `todos:<projectId>`, headline "<n> thing(s) only you can do", action `todos_done`, `steps`,
  `todoIds`); `CardKind` includes `'todos'`; `KIND_ORDER`, `KIND_LABEL.todos` "To-do";
  `DeckInput.todos`.
- `packages/web/src/components/deck/use-deck.ts`: `useOpenTodos()` (done == false) feeds the deck.
- `use-deck-actions.ts` `writeOf`: `todos_done` → `markTodosDone`; `stamps.ts` `YES_NOTE.todos_done`;
  `tones.ts` `todos: 'todo'`; `DetailsSheet.tsx` "Only you can do" heading; `Deck.tsx` `takesNote`
  excludes `todos` cards.
- `packages/web/src/data.ts`: `Todo` (`id, projectId, body, link, done, sourceTaskId, createdAt,
doneAt`); `useOpenTodos`, `useProjectTodos`, `toggleTodo(todo)`, `markTodosDone(todos)`; `track`
  in `lib/use-thread-actions.ts` logs `user_action` and failures.
- Icons only via `src/lib/icons.ts`; tokens `--tone-todo` / `--tone-todo-foreground`,
  `--radius-deck-sheet`; the deck's sheets use `DeckSheet.tsx` (side `top` / `bottom`).

**Selected new contract** (planner decisions within the confirmed scope):

- `useAllTodos()` in `data.ts`: every to-do, done or not (one collection listener).
- Pure `todoSections(input: { todos: readonly Todo[]; projects: readonly Project[]; tasks: readonly Task[] })`
  in new `packages/web/src/lib/todo-drawer.ts` returns the ordered sections
  (`{ projectId, projectName, open: TodoRow[], done: TodoRow[] }`, `TodoRow = { todo, taskTitle }`),
  ordered as criteria 101–102 say; `todoSummary(sections)` gives `{ open, projects }`.
- Components `components/deck/TodoButton.tsx`, `TodoDrawer.tsx`, `TodoDialog.tsx`; the deck's dock
  hosts the button at its left. Ticks write through `track('toggle_todo', todo.id, …)`.
- The `todos` card kind, `todoCards`, the `todos_done` action, `markTodosDone`'s deck use,
  `YES_NOTE.todos_done`, the tone entry and the "Only you can do" heading are removed from the deck;
  `markTodosDone` stays in `data.ts` only if something else still uses it.

**Unresolved:** none.

## Files & modules affected

- `packages/web/src/lib/deck.ts`, `lib/todo-drawer.ts` (new), `data.ts`
- `components/deck/use-deck.ts`, `use-deck-actions.ts`, `stamps.ts`, `tones.ts`, `DetailsSheet.tsx`,
  `DeckDock.tsx`, `pages/Deck.tsx`; new `TodoButton.tsx`, `TodoDrawer.tsx`, `TodoDialog.tsx`
- `lib/icons.ts` (a list icon)
- `docs/features/swipe-deck.md` — the to-do card marked superseded
- Tests: new `tests/todo-drawer-<id>.test.tsx`; existing deck tests that build or count to-do cards

## Principles that apply

- `io-validation` — to-do text and links come from sessions: text rendered as text, a link only
  when `webUrl` accepts it.
- `idempotency` — a tick writes the to-do's own state (`toggleTodo`), so a repeated tap toggles
  predictably; no counters are stored.
- `observability` — `user_action` `toggle_todo` through `track`; failures as the deck's other writes.

## Instrumentation

| event_type                          | severity        | context keys                               | audience |
| ----------------------------------- | --------------- | ------------------------------------------ | -------- |
| `user_action`                       | INFO            | `feature`, `action: toggle_todo`, `target` | internal |
| `api_call_failed` / `feature_error` | WARNING / ERROR | as `track` already logs                    | internal |

## Task class reasoning

Medium: a new UI surface in one module and the removal of a card kind; the only write is the
existing `toggleTodo`. No never-downshift trigger.

## Open questions

- None.

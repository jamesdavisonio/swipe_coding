# Feature: The swipe deck as the board's home

**Status:** Spec confirmed (2026-11-07, James: "spec confirmed" in the session chat)
**Date:** 2026-11-07
**Task class:** Large (five behaviours, D1–D5; numbering continues from `board-briefs.md`, 1–41)
**Prototype:** `docs/features/swipe-deck-prototype.html` (version B, as James tried it on his phone)

## Decision brief (spec)

### Where it came from

You chose the swipe deck (version B) after trying the prototype today, and asked for it to be built so you can try it tomorrow.

### Why it exists

A decision across many sessions should take one swipe, with listening and voice for changes and no typing.

### What will change

The board opens on the deck: one card for each thing waiting on you, including a failed CI with its proposed fix. Threads stays at /threads, tagged threads-v1. For example, "CI failed on PR 24: fix the lint error" appears, and swiping right starts the fix.

### Key assumptions

Holding merge for 3 seconds asks the session to merge it. The skills add a one-line headline to each brief. Passing is remembered on the phone only.

### Out of scope

The stopped-session card, the voice side talk and push notifications.

### What you're agreeing to

A build today in a worktree, as one PR, plus a small change to the skills repo. It goes live once you say "ship it".

## What the user sees

The board opens on one full-screen card at a time. The whole card is tinted by its type, with
the strongest colour for important decisions. It shows the type, how long ago the session asked,
the session (task title) and project, and one large headline saying what happens if James
agrees. Dragging the card shows a stamp naming the decision: right is the card's action ("Build
it", "Merge", "Choose", "Got it"), left is "Later" (the card comes back after the others). A
card with two or more answers opens a sheet of answers when dragged right. Important decisions
(merge) open a sheet with a button he holds for three seconds. Swiping up opens the details
(the example first, then the brief's parts and an "Open in Claude" link to the session).
Swiping down opens an overview of what is waiting, by type and by project; tapping a project
puts all its cards first. A large microphone button sends a voice note that changes the
decision. A speaker button reads the card aloud. Threads stays available at `/threads`.

## Acceptance criteria

### D1 — Cards from the board's data (pure, `packages/web/src/lib/deck.ts`)

42. Given tasks, open to-dos and projects, when the deck is built, there is one card per thing
    waiting on James:
    - a task whose `needs.kind` is `spec` → a `spec` card;
    - `question` → a `fix`, `round` or `summary_gate` card when its question is a brief of that
      gate, a `ci_failed` card when it is a fix brief and the task's stage is `pr`, `merged` or
      `main_ci`, and otherwise a `question` card;
    - `pr` → a `merge` card, which is `important`;
    - `after_deploy` → an `after_deploy` card listing the task's steps with their ticks;
    - open to-dos → one `todos` card per project, listing that project's open to-dos;
    - a done task that is still unread and within the 7-day window → a `summary` card;
    - each `### Suggested next` line of a done task within the 7-day window, not yet handled on
      this phone → a `next` card.
      Done tasks that are read produce no summary card; tasks waiting on nothing produce no card.
43. Given a brief with a `Yes: <phrase>` line directly under its `## Decision brief (<gate>)`
    heading, the card's headline is that phrase. Without it, the headline falls back by kind:
    spec "Start building: <title>", fix "Fix it: <title>", ci_failed "Fix CI: <title>", round
    "Another round: <title>", summary_gate "Ship it: <title>", question the question text,
    merge "Merge PR #<n> into main", after_deploy "Do the <n> after-deploy step(s)", todos
    "<n> thing(s) only you can do", summary "Done: <title>", next the suggestion. A headline
    longer than 60 characters is cut to 59 characters plus "…". Briefs without the `Yes:`
    line parse exactly as before.
44. Given a brief whose "What will change" part has a sentence starting "For example,", the
    card's example is that sentence without the "For example," lead-in, starting with a capital
    letter; otherwise the example is null.
45. Given a question with two or more options, the card offers them as choices with the first
    one recommended. A brief whose closing line is `Reply "<phrase>", or tell me what to
change.` offers that phrase as the single action. A question with neither has no right-swipe
    action (the microphone is its answer).
46. Order: `ci_failed`, `merge`, `spec`, `fix`, `round`, `summary_gate`, `question`,
    `after_deploy`, `todos`, `summary`, `next`; inside a kind, the oldest first. A summary's
    `next` cards follow it. Cards James passed on this phone go after every card he has not
    passed, in the order he passed them, and are marked passed. Choosing a project puts all its
    cards first, keeping their order, then the rest in their order.
47. A spec card is marked revised when the task's spec version is above 1. The overview counts
    the cards by kind and by project.

### D2 — The deck screen

48. Given the board opens at `/`, the deck shows the first card: type, time since it asked,
    session and project, headline. `/threads` shows the Threads home exactly as before, and
    `/t/:taskId`, `/projects`, `/p/:projectId` and `/new` still work. The overview has no link
    to Threads (changed 2026-11-07 at James's request: deeper detail is each card's "Open in
    Claude" link; Threads is still reachable at `/threads`).
49. Dragging a card right past the threshold, or pressing the right arrow, does its action:
    spec approves; fix, round, summary_gate and a phrase-only question answer with the phrase;
    after_deploy ticks every remaining step; todos mark every open to-do of that project done;
    summary marks the task read; next queues a new task in that project titled with the suggestion's "what" part (61).
    While dragging, the stamp shows the action's name. Dragging left, or the left
    arrow, passes the card. A summary card cannot be passed: it springs back. A `next` card
    dragged left opens the skip sheet of criterion 62 instead (changed 2026-11-07, fix
    next-card-context).
50. A card with choices opens a sheet of them, recommended first; tapping one answers with it,
    and closing the sheet leaves the card. An important card opens a sheet whose button must be
    held for 3 seconds; letting go early sends nothing and says to keep holding; the full hold
    asks the session to merge: the need is cleared and the session receives "Merge PR #<n> into
    main." Nothing is typed anywhere.
51. Swiping up, or the up arrow, opens the details: the example first, then the brief's parts,
    then "Open in Claude" linking to the bound session's Claude link when the agent document has
    one (absent otherwise). Swiping down, or the down arrow, opens the overview. Every sheet
    closes with its ✕ button, Escape, a tap outside, or a drag back the way it came from anywhere
    on it (a details sheet scrolled down scrolls first). Sending uses an arrow icon, closing a ✕.
52. With no cards, the deck says "Nothing needs you." and lists the sessions working now (online
    agents bound to a task that is working).
53. Keyboard and screen readers: every move has a named control and a key (←, →, ↑, ↓, M, L),
    focus is visible, targets are at least 44px, colours come from tokens, and the card type is
    written as a word as well as shown by colour.

### D3 — Voice

54. The microphone records a voice note through the browser's speech recognition and shows the
    words as they come; the arrow sends them. A spec note is a change request, a question note
    is the answer, a merge note asks for changes and clears the need, after_deploy and summary
    notes are comments on the task, and a next note queues the task with the note as its
    description. After a note, the card leaves and a line says the deck is waiting for that
    session's revised card, until the task waits on James again or ten minutes pass.
55. The speaker reads the card aloud with the browser's speech synthesis: where it came from,
    the headline, the example, and the brief's parts. Without speech support, the microphone
    falls back to a text box with the same arrow, and the speaker is hidden.
56. The site's Permissions-Policy allows the microphone for the site itself.

### D4 — The agent and the session instructions

57. Given `~/.claude/sessions/<pid>.json` holds `bridgeSessionId: "session_<id>"` (letters and
    digits), `readRemoteUrl({ dir, pid })` returns `https://claude.ai/code/session_<id>`; a
    missing file, unreadable JSON, a missing field or any other shape returns null.
58. The agent keeps `remoteUrl` (string or null) on its agent document: written when it
    registers and refreshed with each heartbeat and each kanban tool call, writing only when the
    value changed.
59. The session instructions tell every session: put a `Yes: <phrase>` line of at most 60
    characters under each brief's heading; turn its own Remote Control on (`set_remote_control`
    with "self") when it creates or starts a task and off once the task's PR is merged, when it
    has that tool; after a change note, revise and post the gate again so James gets a revised
    card; when James writes "Merge PR #<n> into main.", merge it with gh and mark the PR stage
    done; watch CI on the PR and on main after the merge, and when it fails post a fix brief
    with kanban_ask proposing the fix, ending with the "fix confirmed" reply line.

### D6 — Suggested next with context (fix next-card-context, confirmed 2026-11-07)

61. Given a Suggested next line written as `<what to do> — <why>` (an em dash with a space on
    each side), the next card's headline is the "what" part (cut to 60 characters as in 43), its
    `why` is the "why" part, and starting it queues a task titled with the "what" part whose
    description holds the why and which session suggested it. A line without the separator is
    all "what", with `why` null. Swiping up on a next card shows, in order: "Suggested by" with
    the finished session's title, its project and how long ago it finished; "Why" when there
    is one; "What that session finished" with that session's summary (its brief's parts when
    it is a brief, else its text without the Suggested next part) and a link to its pull
    request when it has one; and "If you agree": "Queues a task in <project>. The next session
    there writes a spec, and nothing is built until you confirm it."
62. Dragging a next card left (or the left arrow, or Later) opens a sheet with two answers:
    "Skip for now", which passes the card like any passed card (it comes back after the others),
    and "Never show again", which drops it from this phone for good. Closing the sheet leaves
    the card. The left stamp on a next card reads "Skip".
63. The session instructions tell sessions to write each Suggested next line as
    `<what to do> — <why it matters and what it would change>`.

### D5 — Keeping Threads

60. The commit before this work is tagged `threads-v1`, and no Threads screen or data function
    is removed.

## Out of scope

The stopped-session card, the voice side talk, push notifications, starting a session on the
PC from the phone, and syncing passed cards between devices.

## Files & modules affected (estimate)

- `packages/web/src/lib/deck.ts` (new): cards, order, overview, headline, example.
- `packages/web/src/lib/brief.ts`: the optional `Yes:` line (`Brief.yes`).
- `packages/web/src/data.ts`: `requestMerge`, `sendNote`, `markAllTodosDone`, `queueSuggestion`.
- `packages/web/src/pages/Deck.tsx`, `packages/web/src/components/deck/*` (new); `App.tsx` routes.
- `packages/web/src/lib/speech.ts` (new): recognition and synthesis wrappers.
- `packages/web/src/styles/tokens.css`: card tones for light and dark.
- `packages/shared/src/index.ts`: `AgentDoc.remoteUrl`.
- `packages/agent/src/remote.ts` (new), `board.ts`, `instructions.ts`.
- `firebase.json`: `microphone=(self)`.

## Principles that apply

- **io-validation:** the sessions file and brief text come from outside the code; both readers
  return null or "no brief" on anything unexpected.
- **idempotency:** every decision write is a transaction that writes only while the task still
  waits on it, so a double swipe writes once.
- **gating:** the merge needs a deliberate 3-second hold.
- **observability:** write failures log through the shared logger with existing event types.

## Instrumentation

Reuses existing event types (the data layer's write-failure logging). No new event types.

## Task class reasoning

Large: a new home screen, new writes, an agent change and a session-instruction change.

## Open questions

None.

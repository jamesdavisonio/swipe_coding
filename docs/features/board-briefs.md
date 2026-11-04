# Feature: Decision briefs, finished-work summaries and voice on the board

**Status:** Spec confirmed (2026-11-04, James: "spec confirmed")
**Date:** 2026-11-04
**Task class:** Large (two behaviours, B7 and B8, continuing `web-threads.md` B1–B6)

## Decision brief (spec)

### Where it came from

You asked for this on 4 November, from your notes on decision briefs, after the skills began writing a short brief at every gate.

### Why it exists

Sessions now post briefs, but the board shows them as raw text, finished work leaves no summary in the thread, and you approve from your phone without the context.

### What will change

Briefs show as six short labelled parts with a one-tap reply. Finished tasks end with their summary and suggested next sessions. You can listen to a brief and dictate replies.

### Key assumptions

The board reads briefs from what sessions already post. Your phone's browser does the speech, for free.

### Out of scope

Starting sessions from the board, and writing the briefs.

### What you're agreeing to

Changes to how sessions report finished work and pull requests, built in two behaviours.

## What the user sees

When a session asks James to decide something, the thread and the decision sheet show its
decision brief as six short labelled parts (where it came from, why, what will change, key
assumptions, out of scope, what you're agreeing to) instead of raw text, with the full spec a
tap away and the gate's reply ("another round", "fix confirmed", "ship it") as one button.
When a session opens a pull request, the task waits on him with Open PR and Merged it. When a
session finishes, the thread ends with a Done message carrying its summary and any suggested
next sessions, each with a Copy button, and the task shows as unread so he notices. A Listen
button reads any brief or summary aloud, and a microphone button in every reply box turns his
speech into text he can edit before sending.

## Acceptance criteria

Numbering continues from `web-threads.md` (1–30).

### B7 — Briefs, pull requests and finished-work summaries

31. Given a session message whose text contains a decision brief (a `## Decision brief (<gate>)`
    heading, gate one of spec, fix, round, summary, followed by the six fixed sub-headings in
    order), when the thread renders, the brief shows as a labelled card (Spec, Fix, Another
    round, Summary) with the six parts under their headings in order and any text outside the
    brief below it; a message without a well-formed brief renders exactly as today.
32. Given a task waiting on a spec decision whose session posted a spec brief, when James opens
    Read more, the sheet shows that brief first and the full spec behind a "Full spec" toggle;
    Approve and Changes behave as in B4.
33. Given a task waiting on a question whose text is a brief ending with
    `Reply "<phrase>", or tell me what to change.`, when its row or sheet renders, the title is
    the gate label and task title (never raw markdown), and a one-tap `<phrase>` answer is
    offered beside the free-text answer; tapping it sends exactly that phrase as the answer.
34. Given a session that reports its pull request while the task is past its build or fix
    stage, when the board updates, the task waits on James's merge decision (Open PR, Merged
    it) and the sheet shows the session's latest summary brief, or its summary when it posted
    no brief.
35. Given a session that finishes a task with a summary, when the board updates, the thread
    ends with a Done message carrying that summary (rendered as in 31 when it is a brief), the
    task is marked unread, and the Done tab and the thread header show it as done.
36. Given a finished summary that includes a `### Suggested next` part with one suggestion per
    line, when the thread renders, the suggestions show as a list headed "You could start
    next", each with a Copy button that copies its text; nothing is started automatically.
37. Given a new session, when it connects, the board's instructions tell it: post the spec brief
    as the note when asking for spec approval; post fix, round and summary briefs as
    questions; report the pull request link when opening a PR; finish with a summary that ends
    with `### Suggested next` when it has follow-ups.

### B8 — Voice

38. Given a brief or a finished summary on screen, when James taps Listen, the browser reads it
    aloud in order, gate label first; tapping Stop (or Listen elsewhere) stops it; one reading
    at a time.
39. Given any reply box (composer, change request, free-text answer, reopen note), when James
    taps the microphone, his speech is written into the box as he speaks; he can edit it, and
    nothing is sent until he presses Send.
40. Given a browser without speech synthesis or recognition, the Listen and microphone buttons
    are not shown; given microphone permission denied, an inline note says the microphone is
    blocked and the box still works by typing.
41. Given keyboard-only use, Listen, Stop, the microphone, Full spec, Copy and the one-tap
    answers are reachable, named and show a focus ring (criterion 30 applies).

## Out of scope

- Opening or starting Claude sessions from the board (suggestions are copy-only for now).
- Writing the briefs: the skills do that (skills ADR 0009); the board only shows them.
- Approving by voice without a tap; wake words; paid or cloud speech services.
- Editing or deleting briefs and summaries.
- Changing the six-part brief format (owned by the skills).

## Public contract and existing boundaries

- **Observed baseline:** the skills (ADR 0009, `implement-feature/references/decision-brief.md`,
  2026-11-04) post the spec brief as the `note` on `kanban_subtask` spec → `awaiting_approval`
  (stored today as a session comment of kind `info`), and fix, round and summary briefs as a
  `kanban_ask` question (kind `question`, the whole brief in `needs.question`), closing with
  `Reply "<phrase>", or tell me what to change.`; the board's Approve arrives as
  `kind="approve"` and counts as "spec confirmed". `kanban_update_task` with `pr_url` sets
  `pr` but no need; with `status: 'done'` and `summary` it sets the summary and finishes the
  task without posting to the thread.
- **Selected new contract:** fixed at test time per behaviour (B7, B8), as in `web-threads.md`.
- **Unresolved:** none.

## Files & modules affected

- `packages/web/src/lib/` — brief parsing, speech helpers.
- `packages/web/src/components/` — brief card, decision sheet, messages, composer and reply boxes.
- `packages/agent/src/board.ts`, `index.ts` — PR-ready need, done message, unread, instructions.
- `tests/`, `tests/emulator/` — component and emulator tests per behaviour.

## Principles that apply

- `io-validation` — briefs come from session text: parsed defensively, malformed text falls back
  to plain rendering, never breaks the thread.
- `idempotency` — a repeated PR report or done call does not post a second Done message.
- `graceful-degradation` — speech features are optional; their absence or denial leaves typing.
- `observability` — new taps logged as `user_action` (listen, dictate, copy_suggestion).
- `traceability` — one `request_id` per tap, as before.

## Instrumentation

| event_type        | severity | context keys                                                                                  | audience |
| ----------------- | -------- | --------------------------------------------------------------------------------------------- | -------- |
| `user_action`     | INFO     | `feature`, `action` ∈ listen · stop_listen · dictate · copy_suggestion · gate_reply, `target` | internal |
| `feature_error`   | ERROR    | `feature`, `action` (speech failures other than a denied permission)                          | internal |
| `api_call_failed` | ERROR    | `feature`, `target` = firestore, `action`, `status`                                           | internal |

No R3 proposal needed.

## Task class reasoning

Large: two behaviours across the web app and the desktop agent. Never-downshift triggers present:
a changed write path in the agent (PR-ready need, done message), and a new input boundary (session
text parsed into briefs; microphone input). Each behaviour runs full `implement-feature` ceremony.

## Open questions

- Speech language: English (UK) by default, following the phone's language when it is English.

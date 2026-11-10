# Feature: The deck's microphone works like Workshop's: talk, stop, edit, add more

**Status:** Spec confirmed (revision 2, 2026-11-10, James typed "spec confirmed" in the session chat)
**Date:** 2026-11-10
**Task class:** Medium

## Decision brief (spec)

Yes: Start building the steady Workshop-style microphone

### Where it came from
You asked for this on 9 November; this revision follows your notes on today's mockup.

### Why it exists
The voice note seems to switch itself off and on, and you can't stop it, fix a word or add more.

### What will change
The mic and its square stay steadily on until you stop, heard words show in grey italics, and you tap the text to edit or the mic to add more, in notes and New session. For example, after a pause the square stays on and your words keep growing.

### Key assumptions
Chrome's own recognition stays, so Android's beep after a pause remains.

### Out of scope
Hold-to-clear, and transcription through a server or AI.

### What you're agreeing to
Nothing unusual. Yes starts the build, which runs to a pull request unless something fails.

## What the user sees

Tapping the deck's big microphone ("Change it") opens the note sheet, which is already listening.
What the phone hears appears in the text box in grey italics, after any words already there,
which stay black. Under the box a line says what is going on, and the round microphone button at
the bottom left turns into a red square while it listens; the send arrow sits at the bottom
right. It stays that way, steadily, until James taps the square (or 15 s of silence or 3 minutes
pass): when Android ends its recognition after a pause, the deck starts it again behind the
scenes, and the square, the status line and the words never flicker to "stopped" in between.
Android still plays its start sound at each of those restarts; a web page cannot turn it off.
Tapping the square stops listening and the grey words turn black. Tapping the text at any time
stops listening and opens the keyboard on the text, so a wrong word can be fixed or the text
cleared by typing. Tapping the microphone again listens again and adds the new words after the
text. The arrow sends the note as today. The New session sheet's idea box gets the same
microphone and the same switch between the microphone and the square. The agreed look: the
mockup at https://claude.ai/artifact/3c8ag8TvwqGXx3MJcTT65q, without its hold-to-clear.

For example, on a spec card from "DT [N] Support", James taps the mic and says "The email should
promise a reply within one business day", pauses for a few seconds, and goes on "and show the
address on the success screen". Throughout, the square stays on, the line reads "Listening. Tap
the text to fix a word." and both phrases show in grey italics. He taps the square, the words
turn black, he taps "business", changes it to "working", and sends.

## Acceptance criteria

Numbering follows `pr-ready.md` (134).

### M1 — The note sheet (`VoiceSheet`)

135. Given a browser with speech recognition, when James taps "Change it" on a card, the note
     sheet opens titled "Note for <session>" and is listening at once (as today); the line under
     the title still says what the note does for that card kind (today's "Your note asks for a
     revised spec." and the others).
136. While it listens, the words heard since the microphone was last tapped show in the text box
     in the muted text colour and italic, after the words that were there before, which show in
     the normal text colour, upright. When listening stops (James's tap, 15 s of silence or the
     3-minute cap, unchanged from the voice-notes fix), all the words show in the normal colour,
     upright, and none are lost or repeated.
137. The microphone button sits at the bottom left of the sheet and the send arrow at the bottom
     right. While listening the button shows a square on the recording colour and is named "Stop
     listening"; otherwise it shows the microphone and is named "Start talking" when the box is
     empty and "Add more" when it has text. A tap on "Stop listening" stops listening.
138. A tap on "Start talking" or "Add more" listens again; the new words follow the text already
     in the box (as typed or edited) after one space, and the text before them never changes or
     repeats while listening.
139. While listening, the text is one control named "Stop and edit the text"; tapping it stops
     listening, turns the box into an editable text box holding all the words, focused with the
     caret at the end (so the phone keyboard opens). When not listening, the text box is always
     editable, and what James types (including deleting everything) is what is sent or added to.
140. A status line between the box and the buttons reads "Listening. Tap the text to fix a word."
     while listening (with the moving bars), "Tap the text to edit it, or the mic to add more."
     when stopped with text, and "Tap the mic and talk." when empty.
141. Steady listening: once listening starts, it shows as listening, without a break, until James
     taps the square or the text, 15 s pass with no new words, 3 minutes pass, he sends or closes,
     or the microphone is refused. When the browser ends a recognition run by itself (Android
     after a pause, or after a "no-speech", "aborted" or "network" error), a new run starts
     within a quarter of a second, and at no moment in between does the sheet show the stopped
     state: the button stays "Stop listening", the status line stays the listening line, and the
     words heard in the earlier runs stay in grey italics, in order, each once, with the new
     run's words after them. This holds for any number of such restarts.
142. The send arrow is disabled while there are no words; tapped while listening, it stops
     listening and sends all the words, grey ones included, as today's note. Closing the sheet
     throws the words away, as today.
143. Without speech recognition, or once the microphone is refused, the sheet shows only the text
     box and the send arrow (no microphone button), as today; words heard before a refusal stay
     in the box.

### M2 — The New session idea box

144. The idea box in the New session sheet uses the same microphone: a round microphone button
     under the box at its left, switching between the microphone and the square and named as in
     137, heard words in grey italics after the black text while listening (136), the status
     line (140), a tap on the text to stop and edit (139), a tap on the microphone to add (138),
     and the same steady listening (141). There is no send arrow in the box: "Start session"
     stays the form's button, and pressing it while listening stops listening and uses all the
     words (as today). Without recognition, or once refused, it is a plain text box (as today).

### M3 — Kept from the voice-notes fix

145. The voice-notes fix's behaviour is kept in both places: a phrase Android repeats shows once,
     listening carries on through pauses until stopped, 15 s of silence or 3 minutes (a restart
     resets neither clock), and a tap that stops it does not start it again.

## Out of scope

- Hold-to-clear or any "start over" control: the text is cleared by editing it (James,
  2026-11-10).
- Removing Android's start sound at each restart: Android's recognizer plays it and a web page
  cannot turn it off (Chromium issue 40324711; the compatibility data says `continuous` "can be
  set, but has no effect" on Chrome for Android).
- Sending audio to a server or AI service, or running a speech model in the page (Vosk): James
  chose to keep Chrome's recognition (board answer, 2026-11-10).
- Languages other than English (recognition stays `en-GB`).
- Editing words while the microphone is still listening: tapping the text stops it first.
- Changing the card's behaviour after a note (it leaves and comes back revised, as today), the
  listen (speaker) sheet, or the dock's big microphone.
- A visible timer or a warning before the 3-minute cap.

## Public contract and existing boundaries

- **Observed baseline (commit 19aa6d6):** `useRecognition()` in
  `packages/web/src/components/deck/use-recognition.ts` returns `{ text, listening, refused,
  start, stop, reset }`, exports `SILENCE_MS` (15 000) and `MAX_LISTEN_MS` (180 000); `text` is
  everything said since the last `reset`, with each new run appended after one space; a run
  the browser ends by itself restarts after `RESTART_MS` (250 ms). `VoiceSheet` takes
  `{ card, voice, canRecord, onSend, onClose }`; its names today: "Record more", "Send", "Your
  note". `useIdea()` returns `{ text, type, dictate, stop, listening, refused }`; the idea box's
  button is "Dictate" / "Stop dictating". Tests: `tests/swipe-deck-54*`, `tests/voice-notes-*`,
  and the launch-session idea tests (criterion 120) use those names and a shared
  `FakeRecognition`.
- **Selected new contract (planner's choice, recorded before the tests were written):**
  - Names (accessible names, exact): the microphone button "Start talking" / "Add more" /
    "Stop listening"; while listening, the text is a button "Stop and edit the text"; otherwise
    the box is a textbox named "Your note" (note sheet) or "The idea" (New session, its label
    as today); the arrow "Send". These replace "Record more", "Dictate" and "Stop dictating";
    existing tests and fixture helpers that used the old names
    (`tests/fixtures/fake-recognition.ts` `micStopped`/`sheetWords`, `swipe-deck-54`,
    `voice-notes-94`–`97`, `launch-session-120`) are updated to the new names before the red
    checkpoint, their assertions otherwise unchanged.
  - The words heard in the current listening are inside one element with the attribute
    `data-heard` and the classes `italic` and `text-muted-foreground`; the earlier words are not
    inside it. When not listening there is no `data-heard` element.
  - The status line is an element with `data-testid="mic-status"` and `aria-live="polite"`
    (not `role="status"`, which the deck's toasts use).
  - The restart delay is at most 250 ms (today's `RESTART_MS`); tests may advance fake timers by
    250 ms to see the new run.
  - The recognition hook may expose the words heard in the current listening as a separate
    part; how is the builder's choice.
- **Unresolved:** none.

## Files & modules affected

- `packages/web/src/components/deck/VoiceSheet.tsx` — the new composer layout.
- `packages/web/src/components/deck/NewSessionSheet.tsx`, `use-idea.ts` — the idea box's mic.
- `packages/web/src/components/deck/use-recognition.ts` — the heard-now part beside the text,
  steady listening through restarts and errors.
- New: a shared composer (box, status line, mic button) in `packages/web/src/components/deck/`.
- Tests under `tests/` for 135–145, and name updates in the existing voice and idea tests.

## Principles that apply

- `io-validation` — the note text still goes through the existing send paths and their length
  limits; no new I/O boundary.
- `accessibility` (design system, WCAG AA) — every control is a named button of at least 44 px
  with a keyboard path, and the grey italic text uses `--muted-foreground` (AA on the box).

## Instrumentation

None. The feature adds no failure path and no event; the voice-notes fix logs nothing either.

## Task class reasoning

Medium: user-visible behaviour in two sheets plus a shared component, with existing tests
renamed. Never-downshift triggers checked and absent: no auth, no data writes or schema change,
no external input reaching an AI model, no money, no security headers (the microphone permission
is already allowed).

## Open questions

None.

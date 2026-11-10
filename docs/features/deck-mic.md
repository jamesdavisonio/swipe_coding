# Feature: The deck's microphone works like Workshop's: talk, edit, add more, hold to start over

**Status:** Spec confirmed (2026-11-10, via board approve, comment ThnjPUVYkPshfmEXIuOp)
**Date:** 2026-11-10
**Task class:** Medium

## Decision brief (spec)

Yes: Start building the Workshop-style microphone

### Where it came from
You asked for this on 9 November, and approved the clickable mockup today.

### Why it exists
The voice note gives you no way to stop, fix a word or start again.

### What will change
Heard words show in grey italics; you tap the square to stop, the text to fix it, the mic to add more, or hold it to wipe everything. For example, holding the mic turns the sheet red with a white cross saying "Keep holding to remove everything you said".

### Key assumptions
The phone's own speech recognition stays. The New session idea box gets the same microphone.

### Out of scope
Better transcription through a server or AI service.

### What you're agreeing to
Nothing unusual. Yes starts the build, which runs to a pull request unless something fails.

## What the user sees

Tapping the deck's big microphone ("Change it") opens the note sheet, which is already listening.
What the phone hears appears in the text box in grey italics, after any words already there,
which stay black. Under the box a line says what is going on, and the round microphone button at
the left turns into a red square while it listens; the send arrow sits at the right. Tapping the
square stops listening and the grey words turn black. Tapping the text at any time stops
listening and opens the keyboard on the text, so a wrong word can be fixed. Tapping the
microphone again listens again and adds the new words after the text. Holding the microphone
for two seconds starts over: as the hold builds, the sheet fills red with a big white cross and
the words "Keep holding to remove everything you said" / "Let go to keep it"; at two seconds the
text is gone, "Cleared" shows briefly and the sheet waits for a tap on the microphone. The arrow
sends the note as today. The New session sheet's idea box gets the same microphone: grey italic
words while it listens, a tap on the text to edit, a tap on the microphone to add, a hold to
clear. The agreed look: the mockup at https://claude.ai/artifact/3c8ag8TvwqGXx3MJcTT65q.

For example, on a spec card from "DT [N] Support", James taps the mic and says "The email should
promise a reply within one business day"; the box shows it in grey italics with "Listening. Tap
the text to fix a word." under it. He taps the square, the words turn black and the line reads
"Tap the text to edit it, or the mic to add more." He taps "business", changes it to "working",
taps the mic, says "and show the address on the success screen", and sends.

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
     editable, and what James types is what is sent or added to.
140. A status line between the box and the buttons reads "Listening. Tap the text to fix a word."
     while listening (with the moving bars), "Tap the text to edit it, or the mic to add more."
     when stopped with text, and "Tap the mic and talk." when empty. When the box has text a hint
     between the two buttons reads "Hold the mic to start over"; the microphone button is
     described by it.
141. Given the box has text, when James presses and holds the microphone button, nothing shows
     for the first 0.3 s; then a red layer covers the sheet with a big white cross and the words
     "Keep holding to remove everything you said" and "Let go to keep it", filling up from the
     bottom until 2 s from the press. Letting go (or the finger leaving the button) before then
     removes the layer and keeps the text and the listening state as they were; it is not a tap.
142. When the hold reaches 2 s, the text is removed, listening stops if it was on, the layer
     shows "Cleared" and "Tap the mic to start again." for about 1.5 s, then the empty sheet
     shows. Letting go after that does nothing more. A press shorter than 0.3 s is a tap (137,
     138). With the box empty, holding does nothing and letting go does nothing either.
143. Pressing the microphone opens no context menu, selects no text and does not scroll the
     sheet.
144. Keyboard and screen readers: Enter or Space on the microphone button is a tap. A "Start
     over" button, visually hidden until it takes keyboard focus (like Later and Agree in the
     dock), clears the text at once when there is text; it is not in the tab order while the
     box is empty.
145. The send arrow is disabled while there are no words; tapped while listening, it stops
     listening and sends all the words, grey ones included, as today's note. Closing the sheet
     throws the words away, as today.
146. Without speech recognition, or once the microphone is refused, the sheet shows only the text
     box and the send arrow (no microphone button, no hold), as today; words heard before a
     refusal stay in the box.

### M2 — The New session idea box

147. The idea box in the New session sheet uses the same microphone: a round microphone button
     under the box at its left (named as in 137), heard words in grey italics after the black
     text while listening, a tap on the text to stop and edit (139), a tap on the microphone to
     add (138), the same hold to clear with its red layer over the sheet (141, 142) and the
     "Start over" button (144). There is no send arrow in the box: "Start session" stays the
     form's button, and pressing it while listening stops listening and uses all the words
     (as today). Without recognition, or once refused, it is a plain text box (as today).

### M3 — Kept from the voice-notes fix

148. The voice-notes fix's behaviour is kept in both places: a phrase Android repeats shows once,
     listening carries on through pauses until stopped, 15 s of silence or 3 minutes, and a
     tap that stops it does not start it again.

## Out of scope

- Sending audio to a server or AI service for cleaner text (it would break "no AI in the app");
  the text quality stays the phone's.
- Languages other than English (recognition stays `en-GB`).
- Editing words while the microphone is still listening: tapping the text stops it first.
- Undo after clearing.
- Changing the card's behaviour after a note (it leaves and comes back revised, as today), the
  listen (speaker) sheet, or the dock's big microphone.
- A visible timer or a warning before the 3-minute cap.

## Public contract and existing boundaries

- **Observed baseline (commit 19aa6d6):** `useRecognition()` in
  `packages/web/src/components/deck/use-recognition.ts` returns `{ text, listening, refused,
  start, stop, reset }`, exports `SILENCE_MS` (15 000) and `MAX_LISTEN_MS` (180 000); `text` is
  everything said since the last `reset`, with each new run appended after one space.
  `VoiceSheet` takes `{ card, voice, canRecord, onSend, onClose }`; its names today: "Record
  more", "Send", "Your note". `useIdea()` returns `{ text, type, dictate, stop, listening,
  refused }`; the idea box's button is "Dictate" / "Stop dictating". Tests: `tests/swipe-deck-54*`,
  `tests/voice-notes-*`, and the launch-session idea tests (criterion 120) use those names and
  a shared `FakeRecognition`.
- **Selected new contract (planner's choice):** the names in 137, 139, 140 and 144 replace
  "Record more", "Dictate" and "Stop dictating"; tests that used the old names are updated to the
  new ones. The recognition hook may expose the words heard in the current listening as a
  separate part so the grey part can be told apart; how is the builder's choice. The hold
  timings are 300 ms (tap limit) and 2 000 ms (clear), exported so tests can use them.
- **Unresolved:** none.

## Files & modules affected

- `packages/web/src/components/deck/VoiceSheet.tsx` — the new composer layout.
- `packages/web/src/components/deck/NewSessionSheet.tsx`, `use-idea.ts` — the idea box's mic.
- `packages/web/src/components/deck/use-recognition.ts` — the heard-now part beside the text.
- New: a shared composer (box, status line, mic button, hold layer) and a hold hook, in
  `packages/web/src/components/deck/`.
- `packages/web/src/lib/icons.ts` — the cross and square if not already exported.
- `packages/web/src/index.css` — the hold layer's fill if it needs a keyframe (tokens only).
- Tests under `tests/` for 135–148, and name updates in the existing voice and idea tests.

## Principles that apply

- `io-validation` — the note text still goes through the existing send paths and their length
  limits; no new I/O boundary.
- `accessibility` (design system, WCAG AA) — the hold has a keyboard path (144), every control
  is a named button of at least 44 px, the grey italic text uses `--muted-foreground` (AA on
  the box), and the red layer's white text on `--rec` passes AA.

## Instrumentation

None. The feature adds no failure path and no event; the voice-notes fix logs nothing either.

## Task class reasoning

Medium: user-visible behaviour in two sheets plus a shared component and hook, with existing
tests renamed. Never-downshift triggers checked and absent: no auth, no data writes or schema
change, no external input reaching an AI model, no money, no security headers (the microphone
permission is already allowed).

## Open questions

None.

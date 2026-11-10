# Evidence: deck-mic (criteria 135–145)

Spec: `docs/features/deck-mic.md`. Revision 1 (with hold-to-clear) was approved on the board on
2026-11-10 (approve, comment `ThnjPUVYkPshfmEXIuOp`); James then dropped hold-to-clear, asked for
listening that does not switch itself off and on, and, after online research, chose to keep
Chrome's recognition (board answer "A: steady Chrome mic, beep stays"). Revision 2 was confirmed
by James typing "spec confirmed" in the session chat on 2026-11-10. The agreed look: the mockup at
https://claude.ai/artifact/3c8ag8TvwqGXx3MJcTT65q (heard words grey and italic, at his request).

Profile: anthropic-only (isolation: context). Test author: an isolated Opus 5.5 context (resumed
for its repairs). Fidelity checker: an isolated Opus 5.5 context (one full audit, then delta
checks in the same context). Implementer: an isolated Sonnet 5 context, never given the fidelity
verdicts (resumed for the review repair). Reviewer: a fresh Opus 5.5 context (resumed for the
scoped re-review).

## 1. Commits since the red checkpoint (`91837e7`)

```
58611b5 test(deck-mic): approved post-freeze test for the review's finding
dfc7e78 docs(launch-session): point the idea box's mic names at deck-mic
55df1b7 fix(deck): a stopped run cannot repeat words, and the mic restarts at once
2171af4 refactor(deck): split the voice composer into small parts
64009ed feat(deck): steady Workshop-style microphone in the note sheet and the idea box
```

## 2. Test changes after red

One approved addition, `58611b5` (one new file, nothing changed): `tests/deck-mic-review.test.tsx`,
8 tests in the note sheet and the idea box. A late final result after a stop (Chrome delivers one
before `onend`) never repeats words or refills a cleared box, and a quick "Add more" listens at
once. All 8 fail on 2171af4 (the code before the fix) and pass after 55df1b7. James replied
"another round" on the board (answer `rXPN2MLnDASeTYZQjhTb`). The checker failed its first draft
(the late result equalled the last one, so an "exact repeat" stub passed) and passed the repair.

## 3. Checks on HEAD (58611b5)

- `npm test`: 134 files, 1097 tests passed, exit 0.
- `npm run typecheck` (agent, web, root): exit 0.
- `npx eslint` on every changed source and test file: no output, exit 0. `npm run lint` on the
  whole repo: 0 errors, 21 warnings, all in files this branch does not touch.
- `npx prettier --check` on the changed files: clean. `npm run build:web`: built.
- Secrets scan and stray-artefact scan of `git diff origin/main...HEAD`: nothing found.
- Red run (91837e7): 100 failed, 989 passed. The failures were exactly the 11 deck-mic files and
  the existing voice and idea tests moved to the new names (launch-session-120, voice-notes-94 to
  96); the 2 deck-mic passes were guards for unchanged behaviour (no recognition: a plain box).
- Not verified here: a real Android phone (the restart beep and real timing). The tests drive a
  fake recognizer.

## 4. Test fidelity

Round 1 (full audit): FAIL, 4 gaps and 1 gaming flag. The moving bars were unchecked; the square
versus microphone icon was unchecked (a "rename and recolour, keep the Mic icon" stub passed);
138's intermediate states were unchecked; the idea box lacked the aborted and network restarts.
Two contract lines were added before the repair (930e527): `data-slot="rec-bar"` and `data-icon`.

Round 2 (delta): PASS.

```json
{
  "verdict": "PASS",
  "criteria_map": [
    { "criterion": "137", "tests": ["tests/deck-mic-137.test.tsx (5 tests)"] },
    { "criterion": "138", "tests": ["tests/deck-mic-138.test.tsx (4 tests)"] },
    { "criterion": "140", "tests": ["tests/deck-mic-140.test.tsx (5 tests)"] },
    { "criterion": "144", "tests": ["tests/deck-mic-144.test.tsx (14 tests)"] }
  ],
  "gaps": [],
  "gaming_flags": []
}
```

(The round-1 audit mapped all of 135–145; the delta round re-mapped the four criteria it touched.
The full verdict texts are in the session transcript.)

Post-freeze addition: delta round FAIL (an "exact repeat" stub passed), then PASS with
`gaps: []` and `gaming_flags: []` for 136, 138 and 139.

profile: anthropic-only (context) — test: claude-opus-5-5 / checker: claude-opus-5-5 / build:
claude-sonnet-5. The implementer ran as a fresh context. Prompt-grounding receipt: the author's
packet (`packet-test-author.md`, source snapshot 7bc5474, criteria 135–145) and the builder's
packet (`packet-builder.md`, red SHA 91837e7) were checked before dispatch: the contract names and
markers were in the spec, the shared helpers were named with their paths, and no implementation or
planning transcript was included.

## 5. Review

Full review (diff 91837e7..2171af4): **needs-changes**. One issue: a late final result after a
stop refilled the heard words, so the box showed them twice and clearing could not remove them
(use-recognition.ts). Two non-blocking follow-ups were also passed on: a quick "Add more" dropped
while the old run was ending, and a misleading comment in VoiceSheet.tsx.

Scoped re-review (diff 2171af4..55df1b7): **VERDICT: shippable**. All three resolved, no gaming
markers, no regression of 135–145; 1089 tests passed in the reviewer's own run. Non-blocking note:
after a quick "Add more", an "aborted" error from the new run restarts within 250 ms, which
matches 141.

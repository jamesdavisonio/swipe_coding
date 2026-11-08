# Evidence: voice-notes fix (criteria 94–97)

Fix confirmed by James on the board on 2026-11-08 at 08:17 UTC ("fix confirmed", task
`Kl9b55gBA6xhkJheKCKT`), after his voice note on the merge card came out as "Ill mergel merge yourl
merge your sessionl…" and stopped mid-sentence. Class Small (one hook); spec in the commit messages
and `fix/voice-notes` red commit, criteria 94–97.

Root cause, reproduced with the deck's own `heard()` before the fix: Chrome on Android delivers
each continuous result as the whole stretch heard so far, and the deck concatenated them
("I'll mergeI'll merge yourI'll merge your session…"); Android also ends recognition after a pause
and the deck never restarted it. Behaviour adopted for the end of listening: Workshop's decision
0002 (James's tap, 15 s of silence, 3 minutes).

Profile: anthropic-only (isolation: context). Test author: an isolated Sonnet context. Fidelity
checker: an isolated Opus context, a fresh one per delta. Implementer: an isolated Opus context,
without the fidelity verdicts. No fresh-context review (Small fix ceremony); `check --full` below.

## 1. Commits since the red checkpoint (`be06a96`)

```
23a1fe5 fix(voice-notes): show Android's repeated phrases once and keep listening until stopped
```

## 2. Test changes after red

None (`git diff be06a96..HEAD -- tests` is empty). Before red, the deck's `FakeRecognition` moved
from `tests/swipe-deck-54.test.tsx` into the shared `tests/fixtures/fake-recognition.ts` (same
behaviour, plus `sayResults`, `endByItself`, `fail` and an `abort` that fires `onend` as browsers do).

## 3. Checks on `23a1fe5` (outputs in `checks/`)

- `npx vitest run`: 102 files, 906 tests passed. `npm run typecheck`: exit 0. `npm run lint`:
  0 errors (16 warnings, all in existing tests). `npm run build:web`: built.
- Diff review: one file, `use-recognition.ts` (+80/−28); no secrets, no console, casts or disables.
- Red run: 20 of 906 failed (94, 95, 96 on the bug); the 97 tests and two segment guards in 94
  passed at red as regression guards.
- Test lines (~560, red commit) exceed the 80 changed application lines: the browser's event
  timing (runs ending by themselves, errors, timers across restarts) needs a scenario per rule, and
  each one blocked a concrete wrong fix the fidelity checker named.

## 4. Fidelity gate

Round 1 FAIL (5 gaps, 5 gaming flags: silence clock reset by restarts, a hook stop undone by the
browser's end event, "stopped" flashing during a restart, a restart surviving the sheet's close,
no restart after non-refusing errors). The contract gained one bullet for these before the repair.
Delta 1 FAIL (2 items: a test that required a deferred restart; a no-speech-only allowlist).
Delta 2 PASS (`"gaps": []`, `"gaming_flags": []`). Note for later: `aborted` errors not caused by
James or the hook are not tested directly; the fix restarts on every non-refusing error (no list).

## Not verified

Not tried on an Android phone: covered by the jsdom tests with a fake recognizer. The implementer
added a 250 ms pause before each restart so a failing run cannot restart in a tight loop.

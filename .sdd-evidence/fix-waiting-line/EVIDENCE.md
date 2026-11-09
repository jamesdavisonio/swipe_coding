# Evidence: fix-waiting-line

Fix confirmed by James on the board on 2026-11-09 ("fix confirmed", comment
`zjMCxfE9wj1FxlkDWZv3`), task `JEs5tq99O6T0HT7io3os`. Class: Small (one hook in the deck).

Cause: `useWaiting` (`packages/web/src/components/deck/use-waiting.ts`) only filtered a wait out
of `waiting` while its task had a need newer than the voice note. Answering the revised card
cleared the need, so the line "Waiting for <session>'s revised card…" came back for the rest of
its 10 minutes (James's screenshot, 9 November).

Profile: anthropic-only (isolation: context). Repro test: the orchestrator (plan role, as the fix
chain's debug hop). Implementer: an isolated Opus context. Reviewer: a fresh Opus context.

## 1. Commits since the red checkpoint (`213421c`)

```
c474f83 test(fix-waiting-line): approved post-freeze lint fix (void act)
85753d9 fix(deck): the waiting line ends once the revised card arrives
```

## 2. Test changes after red

One approved amendment, `c474f83`: `act(...)` became `void act(...)` on one line of
`tests/fix-waiting-line.test.tsx` (eslint no-floating-promises). James replied "another round" on
the board (comment `VdwGZ6jVrSIhe0m59Urg`). No assertion changed.

## 3. Checks

- Repro `tests/fix-waiting-line.test.tsx`: red at `213421c` (1 failed: "does not bring it back
  when James then answers the revised card"; 3 guards passed), green after the fix (4 passed).
- `npm test`: 118 of 119 files, 1002 of 1007 tests; the 5 failures are
  `tests/fix-tests-never-live.test.ts`, which cannot read this worktree's junctioned
  `node_modules` from inside its Node permission sandbox (environment only; CI runs it). Deck
  suites (swipe-deck, voice-notes, web-threads plus the repro): 69 files, 691 tests passed.
- `npm run typecheck`: exit 0. `npx eslint .`: 0 errors after `c474f83`. Prettier: clean.

## 4. Review

Fresh review: **shippable**. No state set during render, no effect loop, no flicker on the frame
the card arrives; several waits and a wait re-added after it ended behave correctly. Follow-ups
(not built): tests for two waits on different tasks and for a re-added wait; a comment on why the
prune re-checks `revised`.

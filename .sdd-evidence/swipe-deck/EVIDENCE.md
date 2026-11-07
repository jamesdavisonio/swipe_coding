# Evidence: swipe-deck (criteria 42–60)

Spec: `docs/features/swipe-deck.md` (spec confirmed 2026-11-07 in the session chat).
Profile: anthropic-only (isolation: context). Test authors: two isolated Sonnet contexts
(42–47, 49/50/54 data, 56–59; and 48–55 screens). Fidelity checker: an isolated Opus context.
Implementers: two isolated Opus contexts (logic, data and agent; screens), neither given the
fidelity verdict. Reviewer: a fresh isolated Opus context.

## 1. Commits since the red checkpoint (`77204d6`)

```
6f639ba fix(swipe-deck): review fixes
523e294 fix(swipe-deck): keep the example off the card face
26df05a feat(swipe-deck): the deck screen as the board's home
c837a75 test(swipe-deck): use vi.waitFor in the choices test (harness fix after red)
f765796 feat(swipe-deck): deck cards, deck writes, the agent's Claude link and session rules
```

Before red: `f5cbad6` (spec and prototype), `e8303bf` (contract stubs so the red tests failed on
behaviour, not imports). `threads-v1` tags `bdef64b`, the commit before this work (criterion 60).

## 2. Test changes after red

One approved, harness-only amendment, `c837a75`: in `tests/swipe-deck-50.test.tsx`, Testing
Library's `waitFor` (which never resolves under `vi.useFakeTimers()`) became `vi.waitFor`, and the
unused import was dropped. Same assertion. Approved by the independent fidelity checker as not
weakening the test. `git diff 77204d6..HEAD -- tests`: 1 file, 2 insertions, 2 deletions.

## 3. Checks (outputs in `checks/`)

- `npx vitest run`: 71 files, 706 tests passed (`checks/unit.txt`).
- `npm run test:rules` (emulator): 44 files, 308 tests passed (`checks/emulator.txt`).
- `npm run test:agent`: all good, offline (`checks/agent.txt`) and on the emulator
  (`checks/agent-emulator.txt`).
- `npm run typecheck`: exit 0. `npm run lint`: 0 errors, 15 warnings (tests and the existing
  `agent/test/protocol.ts`). `npm run build:web`: built.
- Contrast: WCAG AA for 60 pairs, light and dark. Firestore rules lint: passed.
- Red run: 128 of 161 new unit tests and all 23 new emulator tests failed for the right reason.
  The 33 that passed at red were regression guards on existing behaviour (old routes, camera and
  geolocation off, "fix confirmed" already in the instructions) or negative cases that a
  do-nothing stub satisfies, each paired with a failing positive test in the same criterion.

## 4. Fidelity gate

Round 1: FAIL (22 gaps, 7 gaming flags: three tests contradicted criterion 46's order, an
ungrounded time format, weak assertions, missing edge cases). The planner settled the open
contract points (time format, type label, stamp texts, dialogs, backdrop, scroll, spec bodies,
agent pid and home, `refreshRemoteUrl`, transactional notes) and the authors revised. Round 2
delta: FAIL (2 gaps: a missing task in suite 46, a dropped heartbeat test in 58). Round 3
delta: PASS, no gaps, no gaming flags.

## 5. Fresh-context review

First review: needs-changes (two blocking issues: `as unknown as` casts on `window` for speech
APIs, and a race where a note's own write could end the "waiting for the revised card" line;
seven non-blocking findings). All nine were fixed in `6f639ba`. Delta re-review: **shippable**.
Notes left for later: the waiting line compares the PC's `updatedAt` with phone-clock marks
(a large clock skew holds a revised card until the 10-minute expiry); pruning passed ids could
run on a partial offline snapshot.

## Visual check

The real deck components were rendered at phone size in light and dark against a fake board
(throwaway harness, not committed): the card, the mid-drag stamp, the details sheet (example
first), the overview and the hold sheet all match the prototype. Not yet tried on James's phone.

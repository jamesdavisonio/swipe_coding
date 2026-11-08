# Evidence: merge-on-github (criteria 89–93)

Spec: `docs/features/merge-on-github.md`, confirmed by James on the board on 2026-11-08 at 07:33
(approve, comment `RMO3kbm3UaoIWHYtsQuN`). It came from the same morning: a session's permission
check refused to merge PR 29 when James asked from the deck, and he asked for the merge card to
link to GitHub and record his own merge instead. Supersedes the merge half of `swipe-deck.md`
criterion 50.

Class: Medium (the tweak guard's Q1 fired: the merge card changes what it does). No
never-downshift trigger: the only write is the existing `markMerged`.

Profile: anthropic-only (isolation: context). Test author: an isolated Sonnet context. Fidelity
checker: an isolated Opus context, a fresh one for the delta. Implementer: an isolated Opus
context, without the fidelity verdicts. Reviewer: a fresh Opus context.

## 1. Commits since the red checkpoint (`42c7dd9`)

```
35968f5 feat(merge-on-github): merge card links to GitHub; agreeing marks it merged
```

Plus the docs commit with this record and the `swipe-deck.md` prose that still described the hold.

## 2. Test changes after red

None: `git diff 42c7dd9..HEAD -- tests` is empty. At the red checkpoint itself, the superseded
tests were brought in line by the test author and approved by the fidelity checker as forced by
the change and nothing more: the hold-to-merge block of `tests/swipe-deck-50.test.tsx` removed
(its three choices cases unchanged), `tests/emulator/swipe-deck-50.test.ts` deleted (it only
covered `requestMerge`), the merge row of the stamp table in `tests/swipe-deck-49.test.tsx`
("Merge" → "I merged it"), and `requestMerge` dropped from the `actions` mock in
`tests/fixtures/web-threads-b2.tsx`.

## 3. Checks on `35968f5` (outputs in `checks/`)

- `npx vitest run`: 98 files, 876 tests passed (`checks/unit.txt`).
- Emulator and rules: 389 tests passed (`checks/emulator.txt`; 4 fewer than before, the deleted
  `requestMerge` suite).
- `npm run test:agent`: all good. `npm run typecheck`: exit 0. `npm run lint`: 0 errors, the same
  19 warnings in tests as on main. `npm run build:web`: built. Contrast not run: no token changed.
- Red run: 19 of 876 failed — the 18 new tests that need the behaviour and the superseded merge
  stamp in swipe-deck-49 — all on assertions (no link, the stamp still "Merge / Hold 3 seconds",
  a sheet opening, `markMerged` never called). The 2 new tests that passed at red assert absence
  (no link on other cards; the details sheet asks for no hold).

## 4. Fidelity gate

Round 1: FAIL, 5 gaps, no gaming flags — no `pr: null` case; the failure log's context unasserted;
"straight away" checked only after `waitFor`; only `sendNote` checked as not called; a structural
test of internal stamp helpers. Delta round 1: PASS (`"gaps": []`, `"gaming_flags": []`).

## 5. Fresh-context review

**shippable.** All five criteria map to tests that fail without the code; no gaming markers; the
hold family (`HoldSheet`, `HoldButton`, `use-hold`, its haptics and the sheet-drag opt-out) and
`requestMerge` removed with no leftovers. Accepted the implementer's choices: the toast "Told
<session> it's merged.", an `aria-hidden` look-alike link on background cards, and leaving the
agent's instruction for a "Merge PR #<n> into main." comment (James can still send one himself).
Follow-ups: the `pr: null` test does not assert the card leaves; the stale `swipe-deck.md` prose
(fixed in the docs commit); check the link's focus ring on every card tint.

## Not verified

Not tried on the phone; covered by the jsdom deck tests.

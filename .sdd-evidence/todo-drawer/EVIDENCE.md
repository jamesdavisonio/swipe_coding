# Evidence: todo-drawer (criteria 98–106)

Spec: `docs/features/todo-drawer.md`, confirmed by James on the board on 2026-11-08 at 08:34
(approve, comment `Pem79Pbnq9BnuRHKmBzo`), from the mock-up he approved the same morning
(https://claude.ai/artifact/Sd761LqAvSBgGHbPJEPjjT; his one note: the tapped row's highlight must not
show over the to-do pop-up — criterion 105). Supersedes the deck's to-do card (`swipe-deck.md`).

Profile: anthropic-only (isolation: context). Test author: an isolated Sonnet context. Fidelity
checker: an isolated Opus context, a fresh one per delta and for the post-red amendment.
Implementer: an isolated Opus context, without the fidelity verdicts. Reviewer: a fresh Opus context.

## 1. Commits since the red checkpoint (`d8fe04f`)

```
eccac71 docs(todo-drawer): record the empty-list line
73bbcbc test(todo-drawer): amendment after red: untick test no longer needs a Done divider
36dd808 refactor(todo-drawer): simpler section order and pending-tick pruning
bed9922 docs(todo-drawer): mark the deck's to-do card superseded in the swipe-deck spec
bc1c520 feat(todo-drawer): to-dos move off the deck into a drawer
```

## 2. Test changes after red

One approved amendment, `73bbcbc`: in `tests/todo-drawer-103.test.tsx`, the untick case unticked the
section's only done to-do but still asserted the row sat before the "Done" divider, which test 102
and spec 102 say is absent when nothing is done (no implementation could pass both). It now asserts
no divider and the open order c, a, b (oldest first). The independent checker approved it as a
defect fix that pins the order more tightly. `git diff d8fe04f..HEAD -- tests`: that one file, +4/−1.

## 3. Checks on HEAD (outputs in `checks/`)

- `npx vitest run --maxWorkers=6`: 107 files, 924 tests passed. (At the default worker count, three
  unrelated Threads suites — web-threads-b5-23, b6-27, b6-30 — sometimes time out under load and pass
  alone; none renders the deck.)
- Emulator and rules: 387 tests passed. `npm run typecheck`: exit 0. `npm run lint`: 0 errors
  (24 warnings, tests only). `npm run build:web`: built. Contrast: WCAG AA for 60 pairs.
- Red run: 93 of 902 failed — the new drawer tests (101/102 at import, the module did not exist) and
  the existing deck suites that build or count to-do cards, whose inputs drop `todos` under the
  recorded contract.
- Test lines (≈930) exceed application lines (≈655): nine criteria of UI behaviour (order, counts,
  optimistic ticks with revert, two stacked dialogs, focus) need a scenario each, plus the existing
  deck suites brought in line with the removed card.

## 4. Fidelity gate

Round 1 FAIL (5 gaps, 4 gaming flags: `feature` missing from log contexts, header counts unchecked
after a tick, "Mark not done" never clicked, only a 3-day age tested). Delta 1 FAIL: 4 closed, one
repair lost its regex backslashes (`/b1b/` instead of `/\b1\b/`). Delta 2 PASS (`"gaps": []`,
`"gaming_flags": []`). Contract decisions recorded before the check: `DeckInput` drops `todos`,
`markTodosDone` removed, `relativeTime` for the age, a native checkbox per row, `sheet-backdrop`.

## 5. Fresh-context review

**shippable.** Every criterion maps to a test that fails without the code; no gaming markers; the
only test change is the approved amendment. Checked in code what jsdom cannot see: transparent tap
highlight on rows (105), 44px targets and the focus ring (106), the to-do dialog as a later portal
above the sheet. Shared deck sheets (details, overview, choices, voice, listen, skip) unchanged in
behaviour: `returnFocus` is opt-in, `aria-modal` only on modal sheets, the new wrapper creates no
stacking context. Follow-ups: "No to-dos yet." (empty-collection line) is not in the spec; all done
to-dos stay in the listener (prune later); two `sheet-backdrop` test ids while both dialogs are open.

## Not verified

Not seen in a browser or on the phone: the board needs an owner sign-in. Covered by the jsdom tests
and the reviewer's code reading.

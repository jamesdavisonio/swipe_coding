# Feature: Merge on GitHub, then tell the session

**Status:** Built (confirmed by James, board approve, 2026-11-08 07:33, comment RMO3kbm3UaoIWHYtsQuN)
**Date:** 2026-11-08
**Task class:** Medium (one module, the deck; changes what the merge card does — criteria 89–93,
numbering continues from `decision-notifications.md`; supersedes the merge half of
`swipe-deck.md` criterion 50)

## Decision brief (spec)

Yes: Make the merge card a link to GitHub and an "I merged it"

### Where it came from

On 8 November a session's permission check refused to merge PR 29 when you asked from the deck, so you merged it on GitHub and asked for the card to work that way.

### Why it exists

The deck's merge asks the session to merge, which its permission check can block, and the 3-second hold slows you down for something you would rather do on GitHub.

### What will change

The merge card shows a link to the pull request on GitHub. You merge it there, come back, and swipe yes, which now means "I merged it" and tells the session at once, with no hold. For example, "Open PR #29 on GitHub", merge, back to the deck, swipe right: the session hears "Merged it."

### Key assumptions

Swiping yes is your word that it is merged; the deck does not check GitHub. The session goes on from there as it does when you mark a pull request merged in Threads.

### Out of scope

The deck checking GitHub, merging from the phone in one step, and Threads (it already has "I merged it").

### What you're agreeing to

One small build to a pull request; the 3-second hold goes away because nothing else uses it.

## What the user sees

A merge card ("Merge PR #29 into main") now carries a link, "Open PR #29 on GitHub", that opens the
pull request in a new browser tab, so James merges it there. Back on the deck he drags the card
right, taps the yes button or presses the right arrow: the card leaves at once, and the task is
marked merged — the same thing Threads' "I merged it" does (stage merged, the session receives
"Merged it."). While the card is dragged right, the stamp says "I merged it" and the line under it
says "Tells the session it's merged". There is no hold sheet and the deck never asks a session to
merge any more. Left (later), up (details) and the microphone work as before.

## Acceptance criteria

89. Given a task waiting on James to merge its pull request (`needs.kind` `pr`, a web `pr.url`),
    its card shows a link named "Open PR #<n> on GitHub" whose target is that url, opening in a
    new tab (`target="_blank"`, `rel` including `noreferrer`); using it neither answers nor
    removes the card.
90. Given that card, when James drags it right past the threshold, taps the yes button or presses
    the right arrow, the task is marked merged straight away — stage `merged`, the need cleared,
    a James comment of kind `merged` with body "Merged it." — and the card leaves the deck. No
    sheet opens and nothing is held.
91. While the merge card is dragged right, its stamp reads "I merged it" and the line under it
    "Tells the session it's merged".
92. Given a merge card whose task has no web `pr.url`, the card shows no GitHub link and
    agreeing still marks it merged.
93. No action on any card asks a session to merge (no comment "Merge PR #<n> into main."), and
    the 3-second hold sheet is gone from the deck.

## Out of scope

- Checking on GitHub that the pull request really is merged.
- Merging from the phone in one step, or through the session.
- Threads and its pull-request decision (unchanged; it already offers "I merged it").
- The details sheet's existing "PR #<n> on GitHub" link (unchanged).

## Public contract and existing boundaries

**Observed baseline** (main at `dd84ba1`):

- `packages/web/src/lib/deck.ts`: `mergeCard` builds kind `merge`, headline
  `Merge <prName> into main`, `action: { type: 'merge' }`, `important: true`; `stampText` maps
  `merge` to "Merge"; `KIND_LABEL.merge` "Merge".
- `packages/web/src/components/deck/use-deck-actions.ts`: `agree` opens the `hold` sheet for a
  `merge` action; `merge(ctx, card)` commits `requestMerge(task)` (action name `request_merge`).
- `packages/web/src/components/deck/stamps.ts`: `YES_NOTE.merge` "Hold 3 seconds to confirm".
- `HoldSheet.tsx`, `HoldButton.tsx`, `use-hold.ts` exist only for the merge; `DeckSheets.tsx`
  routes sheet kind `hold` to `HoldSheet`.
- `packages/web/src/data.ts`: `markMerged(task)` (stage `pr` → `merged`, `needs: null`, history
  `Merged <pr>`, James comment `merged` "Merged it."); `requestMerge(task)`.
- `packages/web/src/lib/threads.ts`: `webUrl(value)` returns an http(s) url or null; `prName`.
- Tests that encode the superseded behaviour: `tests/swipe-deck-50.test.tsx` (hold → request),
  `tests/emulator/swipe-deck-50.test.ts` (`requestMerge` in the emulator).

**Selected new contract** (planner decisions within the confirmed scope):

- `DeckCard` gains `link: { label: string; href: string } | null` — for a merge card with a web
  `pr.url`, `{ label: 'Open PR #<n> on GitHub', href: <pr.url> }`; null on every other card and on
  a merge card without one. The card face renders it as a link.
- The merge action keeps its type name `merge`; `stampText` gives "I merged it", `yesNote`
  "Tells the session it's merged". Agreeing commits `markMerged(task)` with action name
  `mark_merged` (logged as the existing `user_action`), the card flying right like any agreed card.
- `HoldSheet`, `HoldButton`, `use-hold` and the `hold` sheet kind are removed. `requestMerge` is
  removed from `data.ts` with its tests (`swipe-deck-50` merge cases, emulator `swipe-deck-50`);
  the choices half of criterion 50 keeps its tests.

**Unresolved:** none.

## Files & modules affected

- `packages/web/src/lib/deck.ts`, `components/deck/DeckCardFace.tsx`, `stamps.ts`,
  `use-deck-actions.ts`, `DeckSheets.tsx`, `use-deck-sheet.ts` (sheet kinds); removed
  `HoldSheet.tsx`, `HoldButton.tsx`, `use-hold.ts`; `data.ts` (`requestMerge` removed)
- `docs/features/swipe-deck.md` — criterion 50's merge half marked superseded by 89–93
- Tests: new `tests/merge-on-github-<id>.test.tsx`; `tests/swipe-deck-50.test.tsx` and
  `tests/emulator/swipe-deck-50.test.ts` updated for the superseded half

## Principles that apply

- `io-validation` — the link only for a url `webUrl` accepts (http/https).
- `idempotency` — `markMerged` is a transition from stage `pr` only; a second agree changes nothing.
- `observability` — the existing `user_action` event with `action: 'mark_merged'`.

## Instrumentation

| event_type    | severity | context keys                               | audience |
| ------------- | -------- | ------------------------------------------ | -------- |
| `user_action` | INFO     | `feature`, `action: mark_merged`, `target` | internal |

The existing deck commit path already logs this and its failure (`api_call_failed` /
`feature_error`); only the action name is new.

## Task class reasoning

Medium: it changes what an existing card does (Q1 of the tweak guard: an observable change) and
removes a component family, in one module. No never-downshift trigger: the only write is the
existing, validated `markMerged` path; no new input boundary or shared contract.

## Open questions

- None.

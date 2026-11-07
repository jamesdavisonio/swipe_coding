// The small line under each stamp while a card is dragged: what letting go there does. The stamp
// words themselves come from lib/deck.ts (stampText).
import type { DeckAction, DeckCard } from '../../lib/deck.ts'

const YES_NOTE: Record<DeckAction['type'], string> = {
  approve: 'Spec confirmed, building starts',
  phrase: 'Sent to the session',
  choose: 'Pick one next',
  merge: 'Hold 3 seconds to confirm',
  tick_all: 'Every step ticked',
  todos_done: 'Marks them all done',
  read: 'Nothing else is sent',
  queue: 'A new task is queued',
}
const NO_ACTION_NOTE = 'Answer it out loud'

export const yesNote = (card: Pick<DeckCard, 'action'>): string =>
  card.action ? YES_NOTE[card.action.type] : NO_ACTION_NOTE

export function laterNote(card: Pick<DeckCard, 'kind'>): string {
  if (card.kind === 'summary') return 'Marked as read'
  if (card.kind === 'next') return 'For now, or for good'
  return 'Comes back after the others'
}

// A summary is read, not put off: a left drag springs back.

// Which tint a card wears: the whole card is coloured by its kind, the important (merge) tone
// strongest. Classes are spelled out in full so Tailwind sees them; the colours are tokens.
import type { CardKind, DeckCard } from '../../lib/deck.ts'

export type Tone = 'decision' | 'round' | 'important' | 'alert' | 'todo' | 'summary' | 'next'

const KIND_TONE: Record<CardKind, Tone> = {
  ci_failed: 'alert',
  merge: 'important',
  spec: 'decision',
  fix: 'decision',
  round: 'round',
  summary_gate: 'round',
  question: 'decision',
  after_deploy: 'todo',
  todos: 'todo',
  summary: 'summary',
  next: 'next',
}

export const TONE_CLASS: Record<Tone, string> = {
  decision: 'bg-tone-decision text-tone-decision-foreground',
  round: 'bg-tone-round text-tone-round-foreground',
  important: 'bg-tone-important text-tone-important-foreground',
  alert: 'bg-tone-alert text-tone-alert-foreground',
  todo: 'bg-tone-todo text-tone-todo-foreground',
  summary: 'bg-tone-summary text-tone-summary-foreground',
  next: 'bg-tone-next text-tone-next-foreground',
}

export const toneOf = (card: Pick<DeckCard, 'kind' | 'important'>): Tone =>
  card.important ? 'important' : KIND_TONE[card.kind]

export const toneClass = (card: Pick<DeckCard, 'kind' | 'important'>): string =>
  TONE_CLASS[toneOf(card)]

export const kindToneClass = (kind: CardKind): string => TONE_CLASS[KIND_TONE[kind]]

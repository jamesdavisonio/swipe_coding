// A suggested-next card dragged left (or ←, or Later): skip it for now, so it comes back after
// the others, or never show it again on this phone. Closing the sheet leaves the card on top.
import { useId } from 'react'
import type { DeckCard } from '../../lib/deck.ts'
import DeckSheet from './DeckSheet.tsx'

const ANSWERS = [
  { forGood: false, label: 'Skip for now', note: 'It comes back after the others.' },
  { forGood: true, label: 'Never show again', note: 'Dropped from this phone for good.' },
] as const

function Answer({ label, note, onClick }: { label: string; note: string; onClick: () => void }) {
  const noteId = useId()
  return (
    <div>
      <button
        type="button"
        aria-describedby={noteId}
        onClick={onClick}
        className="min-h-16 w-full rounded-xl border-2 border-border px-4 py-3.5 text-left text-lg font-bold"
      >
        {label}
      </button>
      <p id={noteId} className="mt-1 px-1 text-sm text-muted-foreground">
        {note}
      </p>
    </div>
  )
}

export default function SkipSheet({
  card,
  onSkip,
  onClose,
}: {
  card: DeckCard
  onSkip: (forGood: boolean) => void
  onClose: () => void
}) {
  return (
    <DeckSheet
      eyebrow={`${card.session} · ${card.projectName}`}
      title="Skip this suggestion?"
      onClose={onClose}
    >
      <p className="mb-4 leading-normal text-muted-foreground">{card.headline}</p>
      <div className="grid gap-3">
        {ANSWERS.map(({ forGood, label, note }) => (
          <Answer key={label} label={label} note={note} onClick={() => onSkip(forGood)} />
        ))}
      </div>
    </DeckSheet>
  )
}

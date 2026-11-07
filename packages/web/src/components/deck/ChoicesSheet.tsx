// A card with two or more answers: right opens them, recommended first; a tap answers with it,
// closing the sheet leaves the card where it was.
import { cn } from '../../lib/cn.ts'
import type { DeckCard, DeckChoice } from '../../lib/deck.ts'
import DeckSheet from './DeckSheet.tsx'

export default function ChoicesSheet({
  card,
  onChoose,
  onClose,
}: {
  card: DeckCard
  onChoose: (choice: DeckChoice) => void
  onClose: () => void
}) {
  const ordered = [...card.choices].sort((a, b) => Number(b.recommended) - Number(a.recommended))
  return (
    <DeckSheet
      eyebrow={`${card.session} · ${card.projectName}`}
      title={card.headline}
      onClose={onClose}
    >
      <div className="grid gap-2.5">
        {ordered.map((choice) => (
          <button
            key={choice.key ?? choice.label}
            type="button"
            onClick={() => onChoose(choice)}
            className={cn(
              'min-h-16 rounded-xl border-2 px-4 py-3.5 text-left text-lg font-bold',
              choice.recommended ? 'border-foreground' : 'border-border'
            )}
          >
            {choice.label}
            {choice.recommended ? (
              <span className="ml-2 text-xs font-bold tracking-widest text-ok uppercase">
                recommended
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </DeckSheet>
  )
}

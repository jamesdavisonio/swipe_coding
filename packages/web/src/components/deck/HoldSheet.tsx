// An important card (merge): right opens this sheet, whose button must be held for 3 seconds.
// Letting go early sends nothing and says to keep holding. Nothing to type.
import { useState } from 'react'
import type { DeckCard } from '../../lib/deck.ts'
import DeckSheet from './DeckSheet.tsx'
import HoldButton, { HOLD_SECONDS } from './HoldButton.tsx'

const HARD_TO_UNDO = 'This is hard to take back once sessions pick it up.'

export default function HoldSheet({
  card,
  onConfirm,
  onClose,
}: {
  card: DeckCard
  onConfirm: () => void
  onClose: () => void
}) {
  const [letGo, setLetGo] = useState(false)
  const risk = card.brief?.parts.agreeing || HARD_TO_UNDO
  return (
    <DeckSheet
      eyebrow={`Important · ${card.session} · ${card.projectName}`}
      title={card.headline}
      onClose={onClose}
    >
      <p className="leading-normal text-muted-foreground">{risk}</p>
      <p aria-live="polite" className="mt-2 leading-normal text-muted-foreground">
        {letGo
          ? `Keep holding for the full ${HOLD_SECONDS} seconds.`
          : `Hold the arrow for ${HOLD_SECONDS} seconds. Let go to stop.`}
      </p>
      <HoldButton onConfirm={onConfirm} onLetGo={() => setLetGo(true)} />
    </DeckSheet>
  )
}

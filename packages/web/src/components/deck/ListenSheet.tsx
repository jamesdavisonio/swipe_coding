// While the card is read aloud: the words, the part already read in full ink. Not modal, so the
// deck can still be swiped and the speaker tapped again to stop.
import type { DeckCard } from '../../lib/deck.ts'
import DeckSheet from './DeckSheet.tsx'
import type { Reading } from './use-listen.ts'

export default function ListenSheet({
  card,
  reading,
  onClose,
}: {
  card: DeckCard
  reading: Reading
  onClose: () => void
}) {
  return (
    <DeckSheet modal={false} eyebrow="Listening" title={card.session} onClose={onClose}>
      <p className="max-h-[30dvh] overflow-y-auto leading-relaxed">
        <span>{reading.text.slice(0, reading.at)}</span>
        <span className="text-muted-foreground">{reading.text.slice(reading.at)}</span>
      </p>
    </DeckSheet>
  )
}

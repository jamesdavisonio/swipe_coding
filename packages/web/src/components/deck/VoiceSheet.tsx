// "Change it": a voice note for the card's session. The words show as they are heard, the arrow
// sends them (while listening it stops first); without speech recognition (or with the microphone refused) it is a text
// box with the same arrow.
import type { CardKind, DeckCard } from '../../lib/deck.ts'
import { ArrowUp } from '../../lib/icons.ts'
import DeckSheet from './DeckSheet.tsx'
import type { Recognition } from './use-recognition.ts'
import VoiceComposer from './VoiceComposer.tsx'

// What the note does, by the kind of card it changes.
const NOTE_DOES: Partial<Record<CardKind, string>> = {
  spec: 'Your note asks for a revised spec.',
  merge: 'Your note asks for changes before the merge.',
  after_deploy: 'Your note goes to the session as a comment.',
  summary: 'Your note goes to the session as a comment.',
  next: 'Your note becomes the new task’s description.',
}
const ANSWERS = 'Your note is the answer.'
export default function VoiceSheet({
  card,
  voice,
  canRecord,
  onSend,
  onClose,
}: {
  card: DeckCard
  voice: Recognition
  canRecord: boolean
  onSend: (text: string) => void
  onClose: () => void
}) {
  const text = voice.text.trim()
  const does = NOTE_DOES[card.kind] ?? ANSWERS

  return (
    <DeckSheet eyebrow={card.headline} title={`Note for ${card.session}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">{does}</p>
      <VoiceComposer
        voice={voice}
        canRecord={canRecord}
        label="Your note"
        action={
          <button
            type="button"
            aria-label="Send"
            disabled={text === ''}
            onClick={() => onSend(text)}
            className="grid size-15 shrink-0 place-items-center rounded-full bg-me text-me-foreground disabled:opacity-50"
          >
            <ArrowUp aria-hidden="true" className="size-6" />
          </button>
        }
      />
    </DeckSheet>
  )
}

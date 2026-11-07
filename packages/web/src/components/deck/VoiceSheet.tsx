// "Change it": a voice note for the card's session. The words show as they are heard and the
// arrow sends them; without speech recognition (or with the microphone refused) it is a text
// box with the same arrow.
import { useState } from 'react'
import type { CardKind, DeckCard } from '../../lib/deck.ts'
import { ArrowUp, Mic } from '../../lib/icons.ts'
import { Textarea } from '../ui/input.tsx'
import DeckSheet from './DeckSheet.tsx'
import type { Recognition } from './use-recognition.ts'

// What the note does, by the kind of card it changes.
const NOTE_DOES: Partial<Record<CardKind, string>> = {
  spec: 'Your note asks for a revised spec.',
  merge: 'Your note asks for changes before the merge.',
  after_deploy: 'Your note goes to the session as a comment.',
  summary: 'Your note goes to the session as a comment.',
  next: 'Your note becomes the new task’s description.',
}
const ANSWERS = 'Your note is the answer.'
const WAVE_BARS = 14

function Wave() {
  return (
    <div aria-hidden="true" className="my-1 flex h-11 items-center justify-center gap-1">
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <i key={i} data-slot="rec-bar" className="h-2.5 w-1.5 rounded-full bg-rec" />
      ))}
    </div>
  )
}

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
  // What James typed; until he types, the box holds whatever was heard before a refusal.
  const [typed, setTyped] = useState<string | null>(null)
  const typing = !canRecord || voice.refused
  const text = (typing ? (typed ?? voice.text) : voice.text).trim()
  const does = NOTE_DOES[card.kind] ?? ANSWERS

  return (
    <DeckSheet eyebrow={card.headline} title={`Note for ${card.session}`} onClose={onClose}>
      {typing ? (
        <Textarea
          aria-label="Your note"
          rows={3}
          value={typed ?? voice.text}
          onChange={(e) => setTyped(e.target.value)}
          className="text-lg"
        />
      ) : (
        <>
          {voice.listening ? <Wave /> : null}
          <p aria-live="polite" className="min-h-18 text-xl leading-snug font-medium">
            {voice.text || (
              <span className="text-muted-foreground">
                {voice.listening ? 'Listening…' : 'Say what should change.'}
              </span>
            )}
          </p>
        </>
      )}
      <div className="mt-4 flex items-center justify-between gap-4">
        {!typing && !voice.listening ? (
          <button
            type="button"
            onClick={voice.start}
            aria-label="Record more"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border"
          >
            <Mic aria-hidden="true" className="size-5" />
          </button>
        ) : null}
        <p className="text-sm text-muted-foreground">{does}</p>
        <button
          type="button"
          aria-label="Send"
          disabled={text === ''}
          onClick={() => onSend(text)}
          className="grid size-15 shrink-0 place-items-center rounded-full bg-me text-me-foreground disabled:opacity-50"
        >
          <ArrowUp aria-hidden="true" className="size-6" />
        </button>
      </div>
    </DeckSheet>
  )
}

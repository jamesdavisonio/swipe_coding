// The text box with the deck's microphone, shared by the note sheet and the New session idea box.
// While it listens the words are one button (tap to stop and edit) with the newly heard ones in
// grey italics; otherwise the box is editable. Under it a status line, the round microphone
// button at the left, and whatever the sheet puts at the right (the send arrow).
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { Mic, Square } from '../../lib/icons.ts'
import { Textarea } from '../ui/input.tsx'
import type { Recognition } from './use-recognition.ts'

const WAVE_BARS = 14
const LISTENING_LINE = 'Listening. Tap the text to fix a word.'
const STOPPED_LINE = 'Tap the text to edit it, or the mic to add more.'
const EMPTY_LINE = 'Tap the mic and talk.'

function Wave() {
  return (
    <span aria-hidden="true" className="flex h-5 items-center gap-1">
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <i key={i} data-slot="rec-bar" className="h-2.5 w-1.5 rounded-full bg-rec" />
      ))}
    </span>
  )
}

function StatusLine({ voice }: { voice: Recognition }) {
  const line = voice.listening ? LISTENING_LINE : voice.text === '' ? EMPTY_LINE : STOPPED_LINE
  return (
    <p
      data-testid="mic-status"
      aria-live="polite"
      className="flex min-h-6 items-center gap-3 text-sm text-muted-foreground"
    >
      {voice.listening ? <Wave /> : null}
      {line}
    </p>
  )
}

function MicButton({ voice }: { voice: Recognition }) {
  const name = voice.listening ? 'Stop listening' : voice.text === '' ? 'Start talking' : 'Add more'
  const Icon = voice.listening ? Square : Mic
  return (
    <button
      type="button"
      aria-label={name}
      onClick={voice.listening ? voice.stop : voice.start}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full',
        voice.listening ? 'bg-rec text-me-foreground' : 'border border-border text-foreground'
      )}
    >
      <Icon
        aria-hidden="true"
        data-icon={voice.listening ? 'square' : 'mic'}
        className={voice.listening ? 'size-4 fill-current' : 'size-5'}
      />
    </button>
  )
}

export default function VoiceComposer({
  voice,
  canRecord,
  label,
  placeholder,
  maxLength,
  rows = 3,
  action,
  boxId,
}: {
  voice: Recognition
  canRecord: boolean
  // The text box's accessible name ("Your note", "The idea").
  label: string
  placeholder?: string
  maxLength?: number
  rows?: number
  // Right of the microphone button: the note sheet's send arrow.
  action?: ReactNode
  boxId?: string
}) {
  const ownId = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  // Set by a tap on the text: the box takes the focus once it is editable.
  const focusBox = useRef(false)
  const typing = !canRecord || voice.refused

  useEffect(() => {
    const el = box.current
    if (voice.listening || !focusBox.current || !el) return
    focusBox.current = false
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [voice.listening])

  function stopAndEdit() {
    focusBox.current = true
    voice.stop()
  }

  const textarea = (
    <Textarea
      ref={box}
      id={boxId ?? ownId}
      aria-label={boxId ? undefined : label}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      value={voice.text}
      onChange={(e) => voice.edit(e.target.value)}
      className="bg-muted text-lg"
    />
  )
  if (typing) {
    return (
      <>
        {textarea}
        {action ? <div className="mt-4 flex justify-end">{action}</div> : null}
      </>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {voice.listening ? (
        <button
          type="button"
          aria-label="Stop and edit the text"
          onClick={stopAndEdit}
          className="min-h-24 w-full rounded-md bg-muted px-3 py-2.5 text-left text-lg leading-snug"
        >
          {voice.before}
          {voice.heardNow === '' ? null : (
            <span data-heard className="text-muted-foreground italic">
              {voice.before === '' ? '' : ' '}
              {voice.heardNow}
            </span>
          )}
        </button>
      ) : (
        textarea
      )}
      <StatusLine voice={voice} />
      <div className="flex items-center justify-between gap-4">
        <MicButton voice={voice} />
        {action}
      </div>
    </div>
  )
}

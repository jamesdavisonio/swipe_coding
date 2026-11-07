// Which deck sheet is open, and for which card, with the voice and the speaker that two of them
// drive. One sheet at a time: opening one replaces the last (and stops a reading); a sheet whose
// card has left the deck, or a reading that ended, closes by itself.
import { useEffect, useState } from 'react'
import type { DeckCard } from '../../lib/deck.ts'
import { listenScript, speechSupport } from '../../lib/speech.ts'
import type { OpenSheet, SheetKind } from './DeckSheets.tsx'
import { useListen } from './use-listen.ts'
import { useRecognition } from './use-recognition.ts'

export function useDeckSheet(cards: readonly DeckCard[]) {
  const listen = useListen()
  const voice = useRecognition()
  const [canRecord] = useState(() => speechSupport().recognition)
  const [sheet, setSheet] = useState<OpenSheet | null>(null)
  const card = sheet?.cardId ? (cards.find((c) => c.id === sheet.cardId) ?? null) : null
  const speaking = sheet?.kind === 'listen' && listen.reading !== null
  const stale =
    sheet !== null && ((sheet.cardId !== null && !card) || (sheet.kind === 'listen' && !speaking))

  useEffect(() => {
    if (stale) setSheet(null)
  }, [stale])

  const open = (kind: SheetKind, of: DeckCard | null) => {
    if (kind !== 'listen') listen.stop()
    setSheet({ kind, cardId: of?.id ?? null })
  }
  const close = () => {
    listen.stop()
    voice.reset()
    setSheet(null)
  }

  // "Change it": recording starts with the tap (the browser asks for the microphone then).
  const startNote = (of: DeckCard) => {
    voice.reset()
    if (canRecord) voice.start()
    open('voice', of)
  }

  // The speaker toggles: a second tap stops the reading.
  const toggleListen = (of: DeckCard) => {
    if (speaking) return close()
    listen.read(listenScript(of))
    open('listen', of)
  }

  return {
    sheet: stale ? null : sheet,
    card,
    // A modal sheet takes the keys; the listen sheet leaves the deck usable.
    modal: sheet !== null && sheet.kind !== 'listen',
    speaking,
    canListen: listen.supported,
    canRecord,
    voice,
    reading: listen.reading,
    open,
    close,
    startNote,
    toggleListen,
  }
}

// The copy of a card that was just acted on, flying off while the next card is already on top.
import { useCallback, useRef, useState } from 'react'
import type { DeckCard } from '../../lib/deck.ts'
import type { Ghost } from './CardStage.tsx'
import type { Drag } from './use-swipe.ts'

export function useGhost() {
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const lastKey = useRef(0)
  const fly = useCallback((card: DeckCard, to: Ghost['to'], from: Drag | null) => {
    lastKey.current += 1
    setGhost({ key: lastKey.current, card, to, from })
  }, [])
  const landed = useCallback((key: number) => setGhost((g) => (g?.key === key ? null : g)), [])
  return { ghost, fly, landed }
}

// Cards James just acted on: off the deck at once, while the write is in flight and until the
// board's snapshot stops offering them (then forgotten). A failed write puts the card back.
import { useCallback, useEffect, useState } from 'react'
import type { DeckCard } from '../../lib/deck.ts'

export function useGone(offered: readonly DeckCard[]) {
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const ids = new Set(offered.map((c) => c.id))
    setGone((g) =>
      [...g].every((id) => ids.has(id)) ? g : new Set([...g].filter((id) => ids.has(id)))
    )
  }, [offered])

  const hide = useCallback((id: string) => setGone((g) => new Set([...g, id])), [])
  const unhide = useCallback(
    (id: string) => setGone((g) => new Set([...g].filter((k) => k !== id))),
    []
  )
  return { gone, hide, unhide }
}

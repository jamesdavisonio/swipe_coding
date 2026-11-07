// The deck's keys, on the document: ← Later, → Agree, ↑ Details, ↓ Overview, M Change it,
// L Listen. Ignored while typing, with a modifier held, or while a modal sheet has the keys.
import { useEffect, useRef } from 'react'

export type Move = 'later' | 'agree' | 'details' | 'overview' | 'change' | 'listen'

const KEY_MOVE: Record<string, Move> = {
  ArrowLeft: 'later',
  ArrowRight: 'agree',
  ArrowUp: 'details',
  ArrowDown: 'overview',
  m: 'change',
  l: 'listen',
}

function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function useDeckKeys(enabled: boolean, onMove: (move: Move) => void) {
  const latest = useRef(onMove)
  useEffect(() => {
    latest.current = onMove
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target)) return
      const move = KEY_MOVE[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (!move) return
      e.preventDefault()
      latest.current(move)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled])
}

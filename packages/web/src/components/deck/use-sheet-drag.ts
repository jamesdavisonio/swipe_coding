// Dragging a deck sheet back the way it came, from anywhere on it: a bottom sheet goes down, the
// top sheet goes up. A sheet whose body is scrolled away from that edge scrolls first, the hold
// button keeps its own press, and a drag past the distance closes the sheet. While the drag owns
// the gesture, the browser's own panning is held off so the finger stays with the sheet.
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

export type SheetSide = 'bottom' | 'top'

const CLOSE_DRAG_PX = 80
const START_SLOP_PX = 4
const CLICK_AFTER_DRAG_MS = 400
// Elements that keep their own press (the hold button) carry `data-no-sheet-drag`.
const NO_SHEET_DRAG = 'data-no-sheet-drag'

interface Gesture {
  id: number
  x: number
  y: number
  owned: boolean
}

export function useSheetDrag(opts: {
  side: SheetSide
  scroll: RefObject<HTMLElement | null>
  sheet: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const gesture = useRef<Gesture | null>(null)
  const movedAt = useRef(0)
  const [offset, setOffset] = useState<number | null>(null)
  const closing = (dy: number) => (opts.side === 'bottom' ? dy > 0 : dy < 0)

  // The scroll body is at the edge the sheet closes toward.
  function atEdge(): boolean {
    const el = opts.scroll.current
    if (!el) return true
    if (opts.side === 'bottom') return el.scrollTop <= 0
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 1
  }

  // A touch drag the sheet owns must not also pan the page (pointermove runs before touchmove).
  useEffect(() => {
    const el = opts.sheet.current
    if (!el) return
    const hold = (e: TouchEvent) => {
      if (gesture.current?.owned && e.cancelable) e.preventDefault()
    }
    el.addEventListener('touchmove', hold, { passive: false })
    return () => el.removeEventListener('touchmove', hold)
  }, [opts.sheet])

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    const target = e.target as Element
    if (e.button > 0 || target.closest(`[${NO_SHEET_DRAG}]`)) return
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, owned: false }
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.owned) {
      if (dy === 0 && Math.abs(dx) < START_SLOP_PX) return
      if (!closing(dy) || Math.abs(dx) > Math.abs(dy) || !atEdge()) {
        gesture.current = null
        return
      }
      g.owned = true
      e.currentTarget.setPointerCapture(g.id)
    }
    const d = opts.side === 'bottom' ? Math.max(0, dy) : Math.min(0, dy)
    if (Math.abs(d) > START_SLOP_PX) movedAt.current = Date.now()
    setOffset(d)
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    if (!g.owned) return
    const d = e.clientY - g.y
    if (closing(d) && Math.abs(d) > CLOSE_DRAG_PX) opts.onClose()
    else setOffset(null)
  }

  function onPointerCancel() {
    gesture.current = null
    setOffset(null)
  }

  // A click that ends a drag is not a tap on whatever lies under the finger.
  function onClickCapture(e: { stopPropagation: () => void; preventDefault: () => void }) {
    if (Date.now() - movedAt.current < CLICK_AFTER_DRAG_MS) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return {
    offset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  }
}

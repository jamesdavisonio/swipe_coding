// The top card's drag: it locks to one axis after a small move, follows the finger, and on
// release goes right or left past the threshold (or on a quick flick), up or down to open a sheet,
// or nowhere (it springs back). Numbers from the prototype James tried.
import { useRef, useState, type PointerEvent } from 'react'

export type Release = 'right' | 'left' | 'up' | 'down'
export interface Drag {
  dx: number
  dy: number
  axis: 'x' | 'y'
}

const AXIS_LOCK_PX = 9
const THRESHOLD_SHARE = 0.28 // of the stage's width
const MIN_THRESHOLD_PX = 80 // a narrow (or unmeasured) stage still needs a real drag
const FLICK_SPEED = 0.7 // px per ms
const FLICK_MIN_PX = 40
const OPEN_SHEET_PX = 50

export const swipeThreshold = (width: number): number =>
  Math.max(width * THRESHOLD_SHARE, MIN_THRESHOLD_PX)

// How far toward a decision the card is: -1 (left, armed) … 1 (right, armed).
export const swipeProgress = (dx: number, width: number): number =>
  Math.max(-1, Math.min(1, dx / swipeThreshold(width)))

export function releaseOf(drag: Drag, vx: number, width: number): Release | null {
  if (drag.axis === 'y') {
    if (drag.dy < -OPEN_SHEET_PX) return 'up'
    return drag.dy > OPEN_SHEET_PX ? 'down' : null
  }
  const threshold = swipeThreshold(width)
  if (drag.dx > threshold || (vx > FLICK_SPEED && drag.dx > FLICK_MIN_PX)) return 'right'
  if (drag.dx < -threshold || (vx < -FLICK_SPEED && drag.dx < -FLICK_MIN_PX)) return 'left'
  return null
}

interface Gesture {
  id: number
  x: number
  y: number
  lastX: number
  lastAt: number
  vx: number
  axis: Drag['axis'] | null
}

export function useSwipe(opts: {
  enabled: boolean
  width: () => number
  onRelease: (release: Release | null, drag: Drag) => void
}) {
  const gesture = useRef<Gesture | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (!opts.enabled || e.button > 0) return
    const at = performance.now()
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastAt: at,
      vx: 0,
      axis: null,
    }
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      e.currentTarget.setPointerCapture(g.id)
    }
    const at = performance.now()
    g.vx = (e.clientX - g.lastX) / Math.max(1, at - g.lastAt)
    g.lastX = e.clientX
    g.lastAt = at
    setDrag({ dx, dy, axis: g.axis })
  }

  function end(e: PointerEvent<HTMLElement>, released: boolean) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    setDrag(null)
    if (!g.axis) return
    const last: Drag = { dx: e.clientX - g.x, dy: e.clientY - g.y, axis: g.axis }
    opts.onRelease(released ? releaseOf(last, g.vx, opts.width()) : null, last)
  }

  return {
    drag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, true),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, false),
    },
  }
}

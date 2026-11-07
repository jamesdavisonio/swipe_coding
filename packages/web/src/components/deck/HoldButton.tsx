// The deliberate 3-second hold behind an important decision (merge). Pressing fills the button
// and counts down; letting go early stops and empties it; only the full hold confirms. Works by
// finger, mouse, and Space or Enter held down.
import type { CSSProperties } from 'react'
import { ArrowUp } from '../../lib/icons.ts'
import { useHold } from './use-hold.ts'

export const HOLD_MS = 3000
const MS_PER_SECOND = 1000
export const HOLD_SECONDS = HOLD_MS / MS_PER_SECOND
const HOLD_KEYS = [' ', 'Enter']

export default function HoldButton({
  onConfirm,
  onLetGo,
}: {
  onConfirm: () => void
  // Let go before the hold was complete.
  onLetGo: () => void
}) {
  const { phase, held, start, stop } = useHold(HOLD_MS, { confirm: onConfirm, letGo: onLetGo })
  const secondsLeft = Math.max(1, Math.ceil((HOLD_MS - held) / MS_PER_SECOND))
  // The fill grows linearly over the whole hold and drains quickly when let go.
  const fill: CSSProperties =
    phase === 'idle'
      ? { transform: 'scaleX(0)' }
      : {
          transform: 'scaleX(1)',
          transitionDuration: `${HOLD_MS}ms`,
          transitionTimingFunction: 'linear',
        }

  return (
    <button
      type="button"
      aria-label="Hold to confirm"
      data-no-sheet-drag=""
      className="relative mt-4 flex min-h-17 w-full touch-none items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-foreground text-xl font-bold tabular-nums select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (!HOLD_KEYS.includes(e.key) || e.repeat) return
        e.preventDefault()
        start()
      }}
      onKeyUp={(e) => {
        if (HOLD_KEYS.includes(e.key)) stop()
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left bg-tone-important transition-transform duration-(--motion-med)"
        style={fill}
      />
      <ArrowUp aria-hidden="true" className="relative size-6" />
      <span aria-hidden="true" className="relative">
        {phase === 'done' ? '' : secondsLeft}
      </span>
    </button>
  )
}

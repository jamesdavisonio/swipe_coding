// Timing and touch feedback for the deck. Durations come from the motion tokens (tokens.css), so
// prefers-reduced-motion, which sets them to 0ms, shortens the deck's timers too.

type MotionToken = '--motion-fast' | '--motion-med' | '--motion-slow'

const MS_PER_SECOND = 1000

// A motion token in milliseconds ("320ms" or "0.32s"); 0 when the token is not set.
export function motionMs(token: MotionToken): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return raw.endsWith('ms') ? value : value * MS_PER_SECOND
}

// Vibration patterns (ms on, off, on…), as the prototype tuned them on James's phone.
export const HAPTIC = {
  armed: 12, // a dragged card crosses the threshold
  commit: 18, // a card is acted on
  holdStart: 10, // the hold button is pressed
  confirmed: [20, 60, 20], // the hold completed
  refused: [8, 40, 8], // a move the card does not allow
} as const

// A short vibration where the browser can (Android Chrome); nothing elsewhere.
export function buzz(pattern: number | readonly number[]): void {
  if (typeof navigator.vibrate !== 'function') return
  navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern])
}

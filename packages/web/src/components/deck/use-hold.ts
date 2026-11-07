// A press that only counts once held for the whole duration: how long it has been held, and
// whether it is idle, held, or done. Letting go early resets it and says so.
import { useEffect, useRef, useState } from 'react'
import { buzz, HAPTIC } from './motion.ts'

const TICK_MS = 100

export type HoldPhase = 'idle' | 'holding' | 'done'

export function useHold(ms: number, on: { confirm: () => void; letGo: () => void }) {
  const startedAt = useRef<number | null>(null)
  const timers = useRef<{
    done?: ReturnType<typeof setTimeout>
    tick?: ReturnType<typeof setInterval>
  }>({})
  const [phase, setPhase] = useState<HoldPhase>('idle')
  const [held, setHeld] = useState(0)

  const clear = () => {
    clearTimeout(timers.current.done)
    clearInterval(timers.current.tick)
  }
  useEffect(() => clear, [])

  function start() {
    if (startedAt.current !== null || phase === 'done') return
    startedAt.current = Date.now()
    setPhase('holding')
    setHeld(0)
    buzz(HAPTIC.holdStart)
    timers.current.tick = setInterval(() => {
      if (startedAt.current !== null) setHeld(Date.now() - startedAt.current)
    }, TICK_MS)
    timers.current.done = setTimeout(() => {
      clear()
      startedAt.current = null
      setPhase('done')
      buzz(HAPTIC.confirmed)
      on.confirm()
    }, ms)
  }

  function stop() {
    if (startedAt.current === null) return
    clear()
    startedAt.current = null
    setPhase('idle')
    setHeld(0)
    on.letGo()
  }

  return { phase, held, start, stop }
}

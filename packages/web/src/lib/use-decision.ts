// One decision on the sheet: logs the tap, runs the write once, and says whether it is still
// saving or failed. A second tap while the write is pending does nothing (the buttons are
// disabled, and the ref covers a tap that lands before the disabled state has rendered).
import { useRef, useState } from 'react'
import { track } from './use-thread-actions.ts'

export function useDecision(taskId: string, onSaved: () => void) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  async function decide(action: string, write: () => Promise<unknown>) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setFailed(false)
    const saved = await track(action, taskId, write)
    busy.current = false
    setPending(false)
    if (saved) onSaved()
    else setFailed(true)
  }

  return { pending, failed, decide }
}

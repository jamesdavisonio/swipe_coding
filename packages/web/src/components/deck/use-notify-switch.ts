// The overview's bell: this browser's notification state, and a toggle that turns decision
// notifications on (asking Chrome first) or off. lib/push.ts does the work.
import { useState } from 'react'
import { disablePush, enablePush, pushState, type PushState } from '../../lib/push.ts'

export const NOTIFY_LINE = {
  blocked: "Notifications are blocked in Chrome's site settings.",
  unsupported: 'Not available in this browser',
  failed: "Couldn't turn on notifications. Try again.",
} as const

export function useNotifySwitch() {
  const [state, setState] = useState<PushState>(pushState)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const turningOn = state !== 'on'
    setBusy(true)
    const next = turningOn ? await enablePush() : await disablePush()
    setFailed(turningOn && next === 'off')
    setState(next)
    setBusy(false)
  }

  const line =
    state === 'blocked' || state === 'unsupported'
      ? NOTIFY_LINE[state]
      : failed
        ? NOTIFY_LINE.failed
        : null
  return { on: state === 'on', unsupported: state === 'unsupported', busy, line, toggle }
}

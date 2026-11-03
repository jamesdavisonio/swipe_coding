// The after-deploy checkboxes. They follow the task's `afterDone`; a step James has just tapped
// shows his choice at once and keeps it until the snapshot carries it (offline, that is when the
// queued write reaches the server), so a tick never flickers back. A write that fails for good
// drops the choice, which puts the checkbox back, and says so.
import { useEffect, useState } from 'react'
import type { Task } from '@kanban/shared'
import { tickStep } from '../data.ts'
import { log } from './log.ts'
import { FEATURE, track } from './use-thread-actions.ts'

export function useStepTicks(task: Task) {
  const [chosen, setChosen] = useState<Record<number, boolean>>({})
  const [failed, setFailed] = useState(false)
  const steps = Array.isArray(task.afterDeploy) ? task.afterDeploy : []
  const saved = (index: number) => task.afterDone?.[index] === true
  const checked = (index: number) => chosen[index] ?? saved(index)

  // A step whose snapshot now agrees with the choice has no choice of its own any more.
  useEffect(() => {
    setChosen((current) => {
      const open = Object.entries(current).filter(
        ([index, value]) => saved(Number(index)) !== value
      )
      return open.length === Object.keys(current).length ? current : Object.fromEntries(open)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.afterDone])

  async function tick(index: number) {
    const next = !checked(index)
    const completes = next && steps.every((_, i) => i === index || checked(i))
    // The write sees the steps as the screen shows them, including ticks still on their way.
    const shown = { ...task, afterDone: steps.map((_, i) => checked(i)) }
    setChosen((current) => ({ ...current, [index]: next }))
    setFailed(false)
    const ok = await track(
      next ? 'tick_step' : 'untick_step',
      task.id,
      () => tickStep(shown, index),
      completes
        ? (requestId) =>
            log.event('milestone_reached', {
              feature: FEATURE,
              milestone: 'task_done',
              target: task.id,
              request_id: requestId,
            })
        : undefined
    )
    if (ok) return
    setChosen(({ [index]: _dropped, ...rest }) => rest)
    setFailed(true)
  }

  return { steps, checked, tick, failed }
}

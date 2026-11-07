// The sessions a voice note went to. Their cards stay off the deck until the task waits on James
// again after the note, or ten minutes pass, whichever comes first.
//
// "Again" must never be the note's own write. Each wait carries `after`: the task counts as
// revised once it has a need and an updatedAt beyond it.
// - A note that clears the need (spec, question, PR) passes the task's updatedAt at note time:
//   its own write leaves no need, so a need newer than that can only come from the session.
// - A note that leaves the need in place (a comment, e.g. on after-deploy steps) bumps updatedAt
//   itself, so `after` stays unknown (nothing counts) until the write has gone through, and is
//   then set to that moment (`settle`): only a later change from the session counts.
import { useCallback, useEffect, useState } from 'react'
import type { Task } from '@kanban/shared'
import { activeNeed } from '../../lib/threads.ts'

export const REVISED_WAIT_MS = 10 * 60_000

export interface Waiting {
  taskId: string
  session: string
  since: number
  after: number | null
}

const revised = (w: Waiting, task: Task | undefined): boolean =>
  task !== undefined && w.after !== null && activeNeed(task) !== null && task.updatedAt > w.after

export function useWaiting(tasks: readonly Task[]) {
  const [list, setList] = useState<Waiting[]>([])

  // Wake when the oldest wait runs out.
  useEffect(() => {
    if (list.length === 0) return
    const first = Math.min(...list.map((w) => w.since + REVISED_WAIT_MS))
    const id = setTimeout(
      () => setList((l) => l.filter((w) => w.since + REVISED_WAIT_MS > Date.now())),
      Math.max(0, first - Date.now())
    )
    return () => clearTimeout(id)
  }, [list])

  const add = useCallback((taskId: string, session: string, after: number | null) => {
    setList((l) => [
      ...l.filter((w) => w.taskId !== taskId),
      { taskId, session, since: Date.now(), after },
    ])
  }, [])
  // The note's write went through: from now on, a newer need is the session's.
  const settle = useCallback((taskId: string) => {
    const at = Date.now()
    setList((l) =>
      l.map((w) => (w.taskId === taskId && w.after === null ? { ...w, after: at } : w))
    )
  }, [])
  const remove = useCallback((taskId: string) => {
    setList((l) => l.filter((w) => w.taskId !== taskId))
  }, [])

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const waiting = list.filter((w) => !revised(w, byId.get(w.taskId)))
  return { waiting, add, settle, remove }
}

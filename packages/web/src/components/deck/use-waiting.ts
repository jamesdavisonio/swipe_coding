// The sessions a voice note went to. Their cards stay off the deck until the task waits on James
// again (a need, updated after the note) or ten minutes pass, whichever comes first.
import { useCallback, useEffect, useState } from 'react'
import type { Task } from '@kanban/shared'
import { activeNeed } from '../../lib/threads.ts'

export const REVISED_WAIT_MS = 10 * 60_000

export interface Waiting {
  taskId: string
  session: string
  since: number
}

const revised = (w: Waiting, task: Task | undefined): boolean =>
  task !== undefined && activeNeed(task) !== null && task.updatedAt > w.since

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

  const add = useCallback((taskId: string, session: string) => {
    setList((l) => [
      ...l.filter((w) => w.taskId !== taskId),
      { taskId, session, since: Date.now() },
    ])
  }, [])
  const remove = useCallback((taskId: string) => {
    setList((l) => l.filter((w) => w.taskId !== taskId))
  }, [])

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const waiting = list.filter((w) => !revised(w, byId.get(w.taskId)))
  return { waiting, add, remove }
}

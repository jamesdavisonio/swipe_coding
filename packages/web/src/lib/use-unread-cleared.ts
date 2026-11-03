import { useEffect, useRef } from 'react'
import type { Task } from '@kanban/shared'
import { markRead } from '../data.ts'
import { reportFailure } from './use-thread-actions.ts'
import { newRequestId } from './request-id.ts'

// Clears the task's unread flag once per time it turns on while the thread is open: when James
// opens an unread thread, and again when a session message arrives while he is reading. The
// flag we last asked to clear is remembered until the snapshot shows unread off again.
export function useUnreadCleared(task: Task) {
  const asked = useRef(false)
  useEffect(() => {
    if (task.unread !== true) {
      asked.current = false
      return
    }
    if (asked.current) return
    asked.current = true
    markRead(task).catch((err: unknown) => reportFailure('mark_read', newRequestId(), err))
  }, [task])
}

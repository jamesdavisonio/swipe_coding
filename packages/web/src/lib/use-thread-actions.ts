// What a tap on Threads does: log it (with one request id per operation), run the write,
// navigate, or open the decision sheet. The sheet state itself stays with the screen.
import { useLocation, useNavigate } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { answerQuestion, approveSpec, markMerged, markRead } from '../data.ts'
import { log } from './log.ts'
import { newRequestId } from './request-id.ts'
import type { QuickReply } from './threads.ts'

export const FEATURE = 'web-threads'

export type SheetMode = 'read' | 'change'

// Logs a failed write under the request id of the tap that caused it: a Firestore error is
// api_call_failed with its code, anything else is feature_error.
export function reportFailure(action: string, requestId: string, err: unknown) {
  const context = { feature: FEATURE, action, request_id: requestId }
  const code = firestoreCode(err)
  if (code !== null)
    log.error('api_call_failed', `Firestore write failed: ${action}`, {
      ...context,
      target: 'firestore',
      status: code,
    })
  else log.error('feature_error', `${action} failed`, context)
}

// Records a tap, then runs the write. A failed write is logged with the same request id so the
// tap can be followed to its failure, and the result says whether it went through (true when
// there was no write): the row stays as it was (the snapshot is the truth), while the thread's
// composer and the decision sheet use the result to take their optimistic copy back. `onSuccess`
// runs once the write has gone through, with the tap's request id, for events that follow it.
export async function track(
  action: string,
  target: string,
  write?: () => Promise<unknown>,
  onSuccess?: (requestId: string) => void
): Promise<boolean> {
  const requestId = newRequestId()
  log.event('user_action', { feature: FEATURE, action, target, request_id: requestId })
  if (!write) return true
  try {
    await write()
  } catch (err) {
    reportFailure(action, requestId, err)
    return false
  }
  onSuccess?.(requestId)
  return true
}

// A milestone that follows a write, under the request id of the tap that caused it.
export function logMilestone(milestone: string, target: string, requestId: string) {
  log.event('milestone_reached', { feature: FEATURE, milestone, target, request_id: requestId })
}

// The Firestore error code ('permission-denied', 'unavailable', ...) when `err` is a
// FirebaseError, else null.
function firestoreCode(err: unknown): string | null {
  if (!(err instanceof Error) || err.name !== 'FirebaseError') return null
  return 'code' in err && typeof err.code === 'string' ? err.code : 'unknown'
}

export function useThreadActions(openSheet: (task: Task, mode: SheetMode) => void) {
  const navigate = useNavigate()
  const location = useLocation()

  return {
    // The thread's Back button returns to where James came from, project filter included.
    openThread: (task: Task) => {
      void track('open_thread', task.id, task.unread ? () => markRead(task) : undefined)
      void navigate(`/t/${task.id}`, { state: { from: location.pathname + location.search } })
    },
    openForJames: (projectId: string) => {
      void navigate(`/p/${projectId}?tab=james`)
    },
    reply: (task: Task, quick: QuickReply) => {
      switch (quick.kind) {
        case 'approve':
          void track('approve_spec', task.id, () => approveSpec(task))
          break
        case 'answer':
          void track('answer', task.id, () => answerQuestion(task, quick.option))
          break
        case 'phrase':
          void track('gate_reply', task.id, () => answerQuestion(task, { label: quick.label }))
          break
        case 'merged':
          void track('merged', task.id, () => markMerged(task))
          break
        case 'change':
          openSheet(task, 'change')
          break
        case 'read':
          openSheet(task, 'read')
          break
        case 'pr_link':
          break // a real link: the browser opens it
      }
    },
  }
}

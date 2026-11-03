// What a tap on Threads does: log it (with one request id per operation), run the write,
// navigate, or open the decision sheet. The sheet state itself stays with the screen.
import { useNavigate } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { answerQuestion, approveSpec, markMerged, markRead } from '../data.ts'
import { log } from './log.ts'
import { newRequestId } from './request-id.ts'
import type { QuickReply } from './threads.ts'

export const FEATURE = 'web-threads'

export type SheetMode = 'read' | 'change'

// Records a tap, then runs the write; a failed write is logged with the same request id so
// the tap can be followed to its failure: a Firestore error is api_call_failed with its code,
// anything else is feature_error. The row stays as it was (the snapshot is the truth).
export async function track(action: string, target: string, write?: () => Promise<unknown>) {
  const requestId = newRequestId()
  log.event('user_action', { feature: FEATURE, action, target, request_id: requestId })
  if (!write) return
  try {
    await write()
  } catch (err) {
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
}

// The Firestore error code ('permission-denied', 'unavailable', ...) when `err` is a
// FirebaseError, else null.
function firestoreCode(err: unknown): string | null {
  if (!(err instanceof Error) || err.name !== 'FirebaseError') return null
  return 'code' in err && typeof err.code === 'string' ? err.code : 'unknown'
}

export function useThreadActions(openSheet: (task: Task, mode: SheetMode) => void) {
  const navigate = useNavigate()

  return {
    openThread: (task: Task) => {
      void track('open_thread', task.id, task.unread ? () => markRead(task) : undefined)
      void navigate(`/t/${task.id}`)
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

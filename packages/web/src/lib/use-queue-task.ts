// Saving a new task from a form: one request id for the tap, the write once, and what follows. The
// button stays disabled while the save is pending (so a second tap writes nothing); a refused
// save keeps the form and says so. The user_action is logged only once the save has resolved,
// with the new task's id and the same request id.
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, type NewTaskInput } from '../data.ts'
import { log } from './log.ts'
import { newRequestId } from './request-id.ts'
import { FEATURE, reportFailure } from './use-thread-actions.ts'

// What a resolved save hands on: the new task's id and the tap's request id.
export interface SavedTask {
  id: string
  requestId: string
}

// The save behind a form that writes one new task. `save` resolves with the new task, or null when
// it was refused (reported under the tap's request id) or another save was still pending.
export function useTaskSave(feature: string, action: string) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  async function save(projectId: string, input: NewTaskInput): Promise<SavedTask | null> {
    if (busy.current) return null
    busy.current = true
    setPending(true)
    setFailed(false)
    const requestId = newRequestId()
    try {
      const id = await createTask(projectId, input)
      log.event('user_action', { feature, action, target: id, request_id: requestId })
      return { id, requestId }
    } catch (err) {
      reportFailure(action, requestId, err)
      setFailed(true)
      return null
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return { pending, failed, save }
}

// The New task form's save: queue_task, then the task_queued milestone, then back to Threads.
export function useQueueTask() {
  const navigate = useNavigate()
  const { pending, failed, save } = useTaskSave(FEATURE, 'queue_task')

  async function queue(projectId: string, input: NewTaskInput) {
    const saved = await save(projectId, input)
    if (!saved) return
    log.event('milestone_reached', {
      feature: FEATURE,
      milestone: 'task_queued',
      target: saved.id,
      request_id: saved.requestId,
    })
    void navigate('/')
  }

  return { pending, failed, queue }
}

// Saving the New task form: one request id for the tap, the write once, and what follows. The
// button stays disabled while the save is pending (so a second tap writes nothing); a refused
// save keeps the form and says so. queue_task and the task_queued milestone are logged only
// once the save has resolved, with the new task's id and the same request id.
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, type NewTaskInput } from '../data.ts'
import { log } from './log.ts'
import { newRequestId } from './request-id.ts'
import { FEATURE, reportFailure } from './use-thread-actions.ts'

export function useQueueTask() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  async function queue(projectId: string, input: NewTaskInput) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setFailed(false)
    const requestId = newRequestId()
    try {
      const id = await createTask(projectId, input)
      log.event('user_action', {
        feature: FEATURE,
        action: 'queue_task',
        target: id,
        request_id: requestId,
      })
      log.event('milestone_reached', {
        feature: FEATURE,
        milestone: 'task_queued',
        target: id,
        request_id: requestId,
      })
      void navigate('/')
    } catch (err) {
      reportFailure('queue_task', requestId, err)
      setFailed(true)
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return { pending, failed, queue }
}

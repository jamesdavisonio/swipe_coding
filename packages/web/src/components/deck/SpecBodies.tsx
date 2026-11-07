// A spec card's brief lives in the thread, not on the task: one loader per task waiting on a
// spec reads its comments and hands up the latest spec brief's text for the deck to build from.
import { useEffect } from 'react'
import type { Task } from '@kanban/shared'
import { useTaskComments } from '../../data.ts'
import { latestBrief } from '../../lib/brief.ts'

type OnBody = (taskId: string, body: string | null) => void

function SpecBody({ taskId, onBody }: { taskId: string; onBody: OnBody }) {
  const comments = useTaskComments(taskId)
  const body = latestBrief(comments.data, 'spec')?.body ?? null
  useEffect(() => onBody(taskId, body), [taskId, body, onBody])
  return null
}

export default function SpecBodies({ tasks, onBody }: { tasks: readonly Task[]; onBody: OnBody }) {
  return (
    <>
      {tasks.map((task) => (
        <SpecBody key={task.id} taskId={task.id} onBody={onBody} />
      ))}
    </>
  )
}

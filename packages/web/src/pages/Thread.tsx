import { useParams } from 'react-router-dom'
import { isDone } from '@kanban/shared'
import { useAgents, useProjects, useTask, useTaskComments } from '../data.ts'
import ThreadView from '../components/ThreadView.tsx'
import { ThreadFailed, ThreadGone, ThreadLoading } from '../components/ThreadState.tsx'
import { liveProjectIds } from '../lib/projects.ts'
import { useNow } from '../lib/use-now.ts'

// /t/:taskId — one task as a conversation. Only the task and its comments gate the screen; the
// project name and "session live" come from reads that, if they fail, just leave the header
// without them (data.ts logs the failure).
export default function Thread() {
  const { taskId } = useParams()
  const now = useNow()
  const task = useTask(taskId)
  const comments = useTaskComments(taskId)
  const projects = useProjects()
  const agents = useAgents()

  const failed = [task, comments].filter((source) => source.error !== null)
  if (failed.length > 0) return <ThreadFailed failed={failed} />
  if (task.loading || comments.loading) return <ThreadLoading />
  if (!task.data) return <ThreadGone />

  const shown = task.data
  const live = !isDone(shown) && liveProjectIds(agents.data, now).has(shown.projectId)
  return (
    <ThreadView
      key={shown.id}
      task={shown}
      comments={comments.data}
      projectName={projects.data.find((p) => p.id === shown.projectId)?.name ?? null}
      live={live}
      now={now}
    />
  )
}

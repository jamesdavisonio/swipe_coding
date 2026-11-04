// The latest brief of one gate in a task's thread, for the decision sheets that lead with it.
import { useTaskComments } from '../data.ts'
import { latestBrief, type Gate } from './brief.ts'

export function useLatestBrief(taskId: string, gate: Gate) {
  const comments = useTaskComments(taskId)
  return latestBrief(comments.data, gate)
}

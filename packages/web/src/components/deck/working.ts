// The sessions working now: an online agent bound to a task the session is on right now.
import { isAgentOnline, type AgentDoc, type Task } from '@kanban/shared'

export interface WorkingSession {
  taskId: string
  title: string
  projectName: string
}

export function workingSessions(input: {
  tasks: readonly Task[]
  agents: readonly AgentDoc[]
  nameOf: ReadonlyMap<string, string>
  now: number
}): WorkingSession[] {
  const online = new Set(input.agents.filter((a) => isAgentOnline(a, input.now)).map((a) => a.id))
  return input.tasks
    .filter((t) => t.working && t.agentId !== null && online.has(t.agentId))
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      projectName: input.nameOf.get(t.projectId) ?? t.projectId,
    }))
}

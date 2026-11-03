// Everything the Threads screen reads: the four live sources and what is derived from them for
// one project filter. The derivations are the pure helpers in threads.ts.
import { useMemo } from 'react'
import { isAgentOnline } from '@kanban/shared'
import { useAgents, useAllTasks, useOpenTodos, useProjects } from '../data.ts'
import { needsCount, threadRows, type ProjectFilter } from './threads.ts'
import { useNow } from './use-now.ts'

export function useThreadsBoard(filter: ProjectFilter) {
  const now = useNow()
  const tasks = useAllTasks()
  const todos = useOpenTodos()
  const projects = useProjects()
  const agents = useAgents()

  const nameOf = useMemo(() => new Map(projects.data.map((p) => [p.id, p.name])), [projects.data])
  // A project is live while one of its agents is heartbeating.
  const liveProjects = useMemo(
    () => new Set(agents.data.filter((a) => isAgentOnline(a, now)).map((a) => a.projectId)),
    [agents.data, now]
  )
  const rows = useMemo(
    () => threadRows({ tasks: tasks.data, todos: todos.data, filter, now }),
    [tasks.data, todos.data, filter, now]
  )
  const countFor = (projectId: ProjectFilter) =>
    needsCount({ tasks: tasks.data, todos: todos.data, projectId, now })

  return {
    now,
    tasks,
    projects,
    rows,
    nameOf,
    liveProjects,
    countFor,
    loading: tasks.loading || todos.loading || projects.loading,
    failed: [tasks, todos, projects].filter((source) => source.error !== null),
  }
}

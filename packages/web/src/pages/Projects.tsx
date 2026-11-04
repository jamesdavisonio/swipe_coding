import { useMemo } from 'react'
import { useAgents, useAllTasks, useOpenTodos, useProjects } from '../data.ts'
import PageHeader from '../components/PageHeader.tsx'
import ProjectCard from '../components/ProjectCard.tsx'
import Screen from '../components/Screen.tsx'
import { EmptyNote, LoadFailed, LoadingStatus } from '../components/ScreenState.tsx'
import { NO_PROJECTS_TEXT, liveProjectIds, projectCounts } from '../lib/projects.ts'
import { useNow } from '../lib/use-now.ts'

// /projects — one card per folder James has run a session in, in the order useProjects returns
// them (most recently touched first). A failed agents read only costs the live dots (data.ts
// logs it), so only projects, tasks and todos can fail the screen.
export default function Projects() {
  const now = useNow()
  const projects = useProjects()
  const tasks = useAllTasks()
  const todos = useOpenTodos()
  const agents = useAgents()
  const liveIds = useMemo(() => liveProjectIds(agents.data, now), [agents.data, now])

  const failed = [projects, tasks, todos].filter((source) => source.error !== null)
  const loading = [projects, tasks, todos, agents].some((source) => source.loading)
  const liveCount = projects.data.filter((p) => liveIds.has(p.id)).length

  let body
  if (failed.length > 0) body = <LoadFailed title="Couldn't load projects" failed={failed} />
  else if (loading) body = <LoadingStatus label="Loading projects" />
  else if (projects.data.length === 0) body = <EmptyNote>{NO_PROJECTS_TEXT}</EmptyNote>
  else
    body = (
      <ul className="flex flex-col gap-3 px-4">
        {projects.data.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            live={liveIds.has(project.id)}
            counts={projectCounts({
              tasks: tasks.data,
              todos: todos.data,
              projectId: project.id,
              now,
            })}
          />
        ))}
      </ul>
    )

  const sessions =
    failed.length === 0 && !loading
      ? `${liveCount} ${liveCount === 1 ? 'session' : 'sessions'} live`
      : null
  return (
    <Screen
      header={
        <PageHeader
          title="Projects"
          right={
            sessions ? (
              <span className="text-sm font-semibold text-muted-foreground">{sessions}</span>
            ) : null
          }
        />
      }
    >
      {body}
    </Screen>
  )
}

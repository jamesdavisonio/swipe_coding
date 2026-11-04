import type { Project, Task, Todo } from '@kanban/shared'
import { projectCounts } from '../lib/projects.ts'
import ProjectCard from './ProjectCard.tsx'

// One card per project, in the order given, each with its live dot and counts.
export default function ProjectList({
  projects,
  tasks,
  todos,
  liveIds,
  now,
}: {
  projects: Project[]
  tasks: Task[]
  todos: Todo[]
  liveIds: ReadonlySet<string>
  now: number
}) {
  return (
    <ul className="flex flex-col gap-3 px-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          live={liveIds.has(project.id)}
          counts={projectCounts({ tasks, todos, projectId: project.id, now })}
        />
      ))}
    </ul>
  )
}

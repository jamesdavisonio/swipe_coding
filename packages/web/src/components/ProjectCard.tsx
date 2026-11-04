import { Link } from 'react-router-dom'
import type { Project } from '@kanban/shared'
import { ChevronRight } from '../lib/icons.ts'
import { hostLine, type ProjectCounts } from '../lib/projects.ts'
import ProjectTile from './ProjectTile.tsx'
import { Badge } from './ui/badge.tsx'

// One project on Projects: a single link to it, with where it runs, whether a session is live
// and the counts (need you and for James only when above zero).
export default function ProjectCard({
  project,
  live,
  counts,
}: {
  project: Project
  live: boolean
  counts: ProjectCounts
}) {
  return (
    <li>
      <Link
        to={`/p/${project.id}`}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex items-center gap-3">
          <ProjectTile name={project.name} live={live} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-extrabold">{project.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {hostLine(project.hostname, live)}
            </div>
          </div>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        </div>
        <div className="flex flex-wrap gap-2">
          {counts.needs > 0 ? <Badge variant="needs">{`${counts.needs} need you`}</Badge> : null}
          <Badge>{`${counts.live} live`}</Badge>
          <Badge>{`${counts.doneThisWeek} done this week`}</Badge>
          {counts.forJames > 0 ? (
            <Badge variant="me">{`${counts.forJames} for James`}</Badge>
          ) : null}
        </div>
      </Link>
    </li>
  )
}

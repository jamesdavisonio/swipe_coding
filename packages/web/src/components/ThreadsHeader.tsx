import type { Project } from '@kanban/shared'
import ProjectChips from './ProjectChips.tsx'
import { Badge } from './ui/badge.tsx'

// The sticky top of Threads: the title, how many things need James for the current filter, and
// the project chips.
export default function ThreadsHeader({
  waiting,
  projects,
  filter,
  countFor,
  onSelect,
}: {
  waiting: number
  projects: readonly Pick<Project, 'id' | 'name'>[]
  filter: string
  countFor: (projectId: string) => number
  onSelect: (projectId: string) => void
}) {
  return (
    <header className="sticky top-0 z-(--z-sticky) flex flex-col gap-3 bg-background px-4 pt-safe pb-2.5">
      <div className="flex min-h-11 items-center gap-2.5 pt-3.5">
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Threads</h1>
        {waiting > 0 ? (
          <Badge variant="count">{waiting} need you</Badge>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">Nothing needs you</span>
        )}
      </div>
      <ProjectChips projects={projects} filter={filter} countFor={countFor} onSelect={onSelect} />
    </header>
  )
}

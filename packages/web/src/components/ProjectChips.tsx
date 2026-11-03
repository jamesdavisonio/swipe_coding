import type { Project } from '@kanban/shared'
import { cn } from '../lib/cn.ts'

export const ALL_PROJECTS = 'all'

// The filter row under the Threads header: All, then one chip per project, each showing how
// many things need James there. aria-pressed marks the active one; the count is visible text.
export default function ProjectChips({
  projects,
  filter,
  countFor,
  onSelect,
}: {
  projects: readonly Pick<Project, 'id' | 'name'>[]
  filter: string
  countFor: (projectId: string) => number
  onSelect: (projectId: string) => void
}) {
  const chips = [{ id: ALL_PROJECTS, name: 'All' }, ...projects]
  return (
    <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
      {chips.map((chip) => {
        const pressed = chip.id === filter
        const count = countFor(chip.id)
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(chip.id)}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-base font-semibold whitespace-nowrap',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              pressed
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-foreground'
            )}
          >
            {chip.name}
            {count > 0 ? (
              <span className={cn('text-xs font-bold', pressed ? 'text-inherit' : 'text-needs')}>
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

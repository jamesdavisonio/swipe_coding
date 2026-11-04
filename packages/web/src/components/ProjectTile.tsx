import { cn } from '../lib/cn.ts'

// Initials for the tile: first letters of the first two words of the project name.
function initials(name: string): string {
  const letters = name
    .split(/[-_ ]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
  return letters.join('') || '?'
}

// The square tile with a project's initials, and a green dot while a session is live there.
// Decorative: the text next to it says the same in words.
export default function ProjectTile({ name, live }: { name: string; live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex size-12 shrink-0 items-center justify-center rounded-lg',
        'bg-muted text-sm font-extrabold text-foreground'
      )}
    >
      {initials(name)}
      {live ? (
        <span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-card bg-ok" />
      ) : null}
    </span>
  )
}

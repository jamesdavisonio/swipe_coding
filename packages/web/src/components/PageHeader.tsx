import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from '../lib/icons.ts'
import { Button } from './ui/button.tsx'

// The sticky top of the list screens: an optional Back link, the title with a quiet line under
// it, an optional action on the right, and whatever else belongs in the header (a project's tabs).
export default function PageHeader({
  title,
  sub,
  back,
  right,
  children,
}: {
  title: string
  sub?: string
  // Where the Back link goes, and its accessible name.
  back?: { to: string; label: string }
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-(--z-sticky) flex flex-col gap-3 bg-background px-4 pt-safe pb-2.5">
      <div className="flex min-h-11 items-center gap-2.5 pt-3.5">
        {back ? (
          <Button asChild variant="ghost" size="icon" className="-ml-3">
            <Link to={back.to} aria-label={back.label}>
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
          {sub ? (
            <p className="truncate text-xs font-semibold text-muted-foreground">{sub}</p>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </header>
  )
}

import { Link } from 'react-router-dom'
import { TASK_TYPE_LABELS, type Task } from '@kanban/shared'
import { useUser, logOut } from './auth.tsx'
import { legacyStatus, legacySteps, needText, type LegacyStatus } from './lib/legacy-status.ts'
import { Sheet as SheetRoot, SheetContent } from './components/ui/sheet.tsx'
import type { ReactNode } from 'react'

export const STATUS_LABEL: Record<LegacyStatus, string> = {
  queued: 'Queued',
  in_progress: 'In progress',
  waiting_on_james: 'Waiting on me',
  done: 'Done',
}

const STATUS_CLASS: Record<LegacyStatus, string> = {
  queued: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  waiting_on_james: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
}

export function StatusPill({ status }: { status: LegacyStatus }) {
  return <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
}

export function TypePill({ type }: { type: Task['type'] }) {
  return (
    <span className="pill bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
      {TASK_TYPE_LABELS[type]}
    </span>
  )
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return ''
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function TaskCard({ task, projectName }: { task: Task; projectName?: string }) {
  const steps = legacySteps(task)
  const doneSteps = steps.filter((s) => s.status === 'done').length
  const need = needText(task)
  return (
    <Link
      to={`/t/${task.id}`}
      className="card block p-3 hover:border-sky-400 dark:hover:border-sky-600"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {projectName && <div className="truncate text-xs text-slate-500">{projectName}</div>}
          <div className="font-medium leading-snug">{task.title}</div>
        </div>
        <StatusPill status={legacyStatus(task)} />
      </div>
      {need && (
        <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          {need}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <TypePill type={task.type} />
        {steps.length > 0 && (
          <span>
            {doneSteps}/{steps.length} steps
          </span>
        )}
        {task.pr && <span className="text-sky-600 dark:text-sky-400">PR</span>}
        <span className="ml-auto">{timeAgo(task.updatedAt)}</span>
      </div>
    </Link>
  )
}

export function TopBar({
  title,
  back,
  right,
}: {
  title: ReactNode
  back?: string
  right?: ReactNode
}) {
  const user = useUser()
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur pt-safe dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-3">
        {back ? (
          <Link to={back} className="btn-ghost -ml-2 px-2" aria-label="Back">
            ‹
          </Link>
        ) : (
          <img src="/icon.svg" alt="" className="h-6 w-6" />
        )}
        <div className="min-w-0 flex-1 truncate font-semibold">{title}</div>
        {right}
        {user && (
          <button
            className="ml-1 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-300 text-[10px] dark:bg-slate-700"
            title={`${user.email} — tap to sign out`}
            onClick={() => {
              if (confirm('Sign out?')) void logOut()
            }}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-full w-full" />
            ) : (
              (user.email ?? '?')[0].toUpperCase()
            )}
          </button>
        )}
      </div>
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-5xl px-3 pb-24 pt-3 pb-safe">{children}</main>
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
      {children}
    </div>
  )
}

export function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {count}
          </span>
        )}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

// Legacy open/onClose API over the design-system bottom sheet (focus trap, Escape, a11y).
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  return (
    <SheetRoot open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent title={title}>{children}</SheetContent>
    </SheetRoot>
  )
}

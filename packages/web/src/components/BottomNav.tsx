import { Link, useLocation } from 'react-router-dom'
import { useAllTasks, useOpenTodos } from '../data.ts'
import { cn } from '../lib/cn.ts'
import { Folder, MessageSquare, Plus, type LucideIcon } from '../lib/icons.ts'
import { needsCount } from '../lib/threads.ts'
import { Badge } from './ui/badge.tsx'

type NavId = 'threads' | 'projects' | 'new'

const ITEMS: { id: NavId; label: string; to: string; Icon: LucideIcon }[] = [
  { id: 'threads', label: 'Threads', to: '/', Icon: MessageSquare },
  { id: 'projects', label: 'Projects', to: '/projects', Icon: Folder },
  { id: 'new', label: 'New task', to: '/new', Icon: Plus },
]

// Which item the current path belongs to: a thread is part of Threads (at /threads since the
// deck became home), a project part of Projects. Anything else (the catch-all redirect, say)
// marks nothing.
function currentItem(pathname: string): NavId | null {
  if (pathname === '/' || pathname === '/threads' || pathname.startsWith('/t/')) return 'threads'
  if (pathname === '/projects' || pathname.startsWith('/p/')) return 'projects'
  if (pathname === '/new') return 'new'
  return null
}

// The three-way bottom navigation. The Threads item carries the all-projects needs-you count;
// the nav reads the data hooks itself so every screen that shows it stays in step.
export default function BottomNav() {
  const { pathname } = useLocation()
  const tasks = useAllTasks()
  const todos = useOpenTodos()
  const waiting = needsCount({ tasks: tasks.data, todos: todos.data })
  const current = currentItem(pathname)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-card pb-safe"
    >
      <div className="mx-auto flex max-w-(--content-max) justify-around px-4 py-2">
        {ITEMS.map(({ id, label, to, Icon }) => (
          <Link
            key={id}
            to={to}
            aria-current={current === id ? 'page' : undefined}
            className={cn(
              'relative flex min-h-12 min-w-18 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-bold',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              current === id ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
            {label}
            {id === 'threads' && waiting > 0 ? (
              <>
                <Badge variant="count" aria-hidden="true" className="absolute top-0.5 right-3">
                  {waiting}
                </Badge>
                <span className="sr-only">, {waiting} waiting for you</span>
              </>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  )
}

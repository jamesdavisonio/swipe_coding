import type { ReactNode } from 'react'
import type { Task, Todo } from '@kanban/shared'
import { isDone } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import {
  daysUntilHidden,
  forJamesSummary,
  isDateable,
  quickReplies,
  relativeTime,
  stageText,
  type QuickReply,
} from '../lib/threads.ts'
import ProjectTile from './ProjectTile.tsx'
import QuickReplies from './QuickReplies.tsx'

// The row's open control is a button whose accessible name starts with the title: the tile
// is decorative (aria-hidden) and the meta and preview lines follow the title and time. The
// spaces between the parts are no-ops in the flex layout but keep the row's text readable
// to anything that concatenates it (assistive tech, copy, search).
function RowButton({
  tile,
  title,
  at,
  now,
  meta,
  preview,
  unread,
  onClick,
}: {
  tile: ReactNode
  title: string
  at: number
  now: number
  meta: ReactNode
  preview: string
  unread: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {tile}{' '}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-lg font-bold">{title}</span>{' '}
          {isDateable(at) ? (
            <time
              dateTime={new Date(at).toISOString()}
              className={cn(
                'shrink-0 text-xs tabular-nums',
                unread ? 'font-bold text-needs' : 'text-muted-foreground'
              )}
            >
              {relativeTime(at, now)}
            </time>
          ) : null}
        </span>{' '}
        <span className="text-xs font-semibold text-muted-foreground">{meta}</span>{' '}
        {preview ? (
          <span
            className={cn(
              'line-clamp-2 text-base',
              unread ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {preview}
          </span>
        ) : null}
      </span>
    </button>
  )
}

const rowClass = (unread: boolean) =>
  cn('border-b border-border px-4 py-3.5', unread ? 'bg-needs-soft/45' : 'bg-card')

const tileClass =
  'relative flex size-12 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold'

export function TaskRow({
  task,
  projectName,
  live,
  now,
  onOpen,
  onReply,
}: {
  task: Task
  projectName: string
  live: boolean
  now: number
  onOpen: (task: Task) => void
  onReply: (task: Task, reply: QuickReply) => void
}) {
  const unread = task.unread === true
  const goneIn = isDone(task) ? daysUntilHidden(task, now) : null
  return (
    <li className={rowClass(unread)}>
      <RowButton
        tile={<ProjectTile name={projectName} live={live && !isDone(task)} />}
        title={task.title}
        at={task.updatedAt}
        now={now}
        meta={
          <>
            {projectName} · {stageText(task)}
            {goneIn !== null ? ` · gone in ${goneIn} d` : ''}
            {live && !isDone(task) ? <span className="sr-only"> · session live</span> : null}
            {unread ? <span className="sr-only"> · unread</span> : null}
          </>
        }
        preview={typeof task.summary === 'string' ? task.summary : ''}
        unread={unread}
        onClick={() => onOpen(task)}
      />
      <QuickReplies replies={quickReplies(task)} onReply={(reply) => onReply(task, reply)} />
    </li>
  )
}

export function ForJamesRow({
  projectId,
  projectName,
  todos,
  at,
  now,
  onOpen,
}: {
  projectId: string
  projectName: string
  todos: Todo[]
  at: number
  now: number
  onOpen: (projectId: string) => void
}) {
  return (
    <li className={rowClass(false)}>
      <RowButton
        tile={
          <span aria-hidden="true" className={cn(tileClass, 'bg-primary text-primary-foreground')}>
            JD
          </span>
        }
        title={`For James · ${projectName}`}
        at={at}
        now={now}
        meta={forJamesSummary(todos.length)}
        preview={todos.map((todo) => todo.body).join(' · ')}
        unread={false}
        onClick={() => onOpen(projectId)}
      />
    </li>
  )
}

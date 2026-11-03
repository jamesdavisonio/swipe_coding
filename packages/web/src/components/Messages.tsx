import { cn } from '../lib/cn.ts'
import type { Comment } from '@kanban/shared'
import { sentTime, sessionLabel } from '../lib/messages.ts'
import Ticks from './Ticks.tsx'

const LABEL = 'mx-2.5 text-xs font-bold text-muted-foreground'
const BUBBLE = 'rounded-xl px-3.5 py-3 text-base leading-snug whitespace-pre-line'

export function SessionMessage({
  comment,
  now,
  readMore,
  onReadMore,
}: {
  comment: Comment
  now: number
  readMore: boolean
  onReadMore: () => void
}) {
  return (
    <div className="flex max-w-[88%] flex-col items-start gap-1">
      <span className={LABEL}>{sessionLabel(comment, now)}</span>
      <div
        className={cn(
          BUBBLE,
          'rounded-bl-sm border bg-card',
          readMore ? 'border-needs/50' : 'border-border'
        )}
      >
        <p>{comment.body}</p>
        {readMore ? (
          <button
            type="button"
            onClick={onReadMore}
            className="mt-2 inline-flex min-h-11 items-center font-bold text-primary"
          >
            Read more
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function JamesMessage({ comment, now }: { comment: Comment; now: number }) {
  return (
    <div className="flex max-w-[80%] flex-col items-end gap-1 self-end">
      <div className={cn(BUBBLE, 'rounded-br-sm bg-me text-me-foreground')}>
        <p>{comment.body}</p>
      </div>
      <span className={cn(LABEL, 'inline-flex items-center gap-1')}>
        {sentTime(comment, now)} · <Ticks comment={comment} />
      </span>
    </div>
  )
}

// A quiet centred line from the system: its text only.
export function SystemLine({ comment }: { comment: Comment }) {
  return (
    <p className="max-w-[85%] self-center text-center text-xs font-semibold text-muted-foreground">
      {comment.body}
    </p>
  )
}

// Three dots while the session is working. Decorative: the status carries the name.
export function Typing() {
  return (
    <div
      role="status"
      aria-label="Session is working"
      className="flex w-fit items-center gap-1 rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3.5"
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          data-slot="typing-dot"
          aria-hidden="true"
          className="size-1.5 rounded-full bg-muted-foreground opacity-50"
        />
      ))}
    </div>
  )
}

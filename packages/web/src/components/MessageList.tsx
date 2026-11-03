import type { ReactNode } from 'react'
import type { Comment } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import { messageShape, sentTime, sessionLabel } from '../lib/messages.ts'
import Ticks from './Ticks.tsx'

const LABEL = 'mx-2.5 text-xs font-bold text-muted-foreground'
const BUBBLE = 'rounded-xl px-3.5 py-3 text-base leading-snug whitespace-pre-line'

function SessionMessage({
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

function JamesMessage({ comment, now }: { comment: Comment; now: number }) {
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

// Three dots while the session is working. Decorative: the status carries the name.
function Typing() {
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

// The conversation, oldest first: quiet centred system lines, the session's messages on the
// left under their kind label, James's on the right with time and ticks, and the typing dots
// after the last one while the session works. Only the message `readMoreId` names carries Read
// more.
export default function MessageList({
  messages,
  now,
  readMoreId,
  working,
  onReadMore,
}: {
  messages: Comment[]
  now: number
  readMoreId: string | null
  working: boolean
  onReadMore: () => void
}) {
  const view = (comment: Comment): ReactNode => {
    switch (messageShape(comment)) {
      case 'system':
        return (
          <p
            key={comment.id}
            className="max-w-[85%] self-center text-center text-xs font-semibold text-muted-foreground"
          >
            {comment.body}
          </p>
        )
      case 'james':
        return <JamesMessage key={comment.id} comment={comment} now={now} />
      case 'session':
        return (
          <SessionMessage
            key={comment.id}
            comment={comment}
            now={now}
            readMore={comment.id === readMoreId}
            onReadMore={onReadMore}
          />
        )
    }
  }
  return (
    <div role="log" aria-label="Conversation" className="flex flex-col gap-3 py-3">
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
      ) : null}
      {messages.map(view)}
      {working ? <Typing /> : null}
    </div>
  )
}

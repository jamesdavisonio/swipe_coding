import type { ReactNode } from 'react'
import type { Comment } from '@kanban/shared'
import { messageShape } from '../lib/messages.ts'
import { JamesMessage, SessionMessage, SystemLine, Typing } from './Messages.tsx'

// The conversation, oldest first: quiet centred system lines, the session's messages on the
// left under their kind label, James's on the right with time and ticks, and the typing dots
// after the last one while the session works. Only the message `readMoreId` names carries Read
// more. An empty conversation says `emptyText`.
export default function MessageList({
  messages,
  now,
  readMoreId,
  working,
  emptyText,
  onReadMore,
}: {
  messages: Comment[]
  now: number
  readMoreId: string | null
  working: boolean
  emptyText: string
  onReadMore: () => void
}) {
  const view = (comment: Comment): ReactNode => {
    switch (messageShape(comment)) {
      case 'system':
        return <SystemLine key={comment.id} comment={comment} />
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
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : null}
      {messages.map(view)}
      {working ? <Typing /> : null}
    </div>
  )
}

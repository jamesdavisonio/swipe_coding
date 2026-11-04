import type { Comment } from '@kanban/shared'
import { parseBrief, suggestedNext, withoutSuggestedNext } from '../lib/brief.ts'
import { bodyText } from '../lib/messages.ts'
import BriefCard from './BriefCard.tsx'
import SuggestedNext from './SuggestedNext.tsx'

// The text of a session message. A well-formed decision brief shows as its card with the text
// around it above and below; anything else is the text as it is. A Done message also lists its
// `### Suggested next` part as "You could start next" with a Copy button per suggestion.
export default function MessageBody({ comment }: { comment: Comment }) {
  const body = bodyText(comment)
  const suggestions = comment.kind === 'done' ? suggestedNext(body) : []
  const text = suggestions.length > 0 ? withoutSuggestedNext(body) : body
  const brief = parseBrief(text)
  return (
    <>
      {brief ? (
        <div className="flex flex-col gap-2.5">
          {brief.before ? <p>{brief.before}</p> : null}
          <BriefCard brief={brief} />
          {brief.after ? <p>{brief.after}</p> : null}
        </div>
      ) : (
        <p>{text}</p>
      )}
      <SuggestedNext items={suggestions} taskId={comment.taskId} />
    </>
  )
}

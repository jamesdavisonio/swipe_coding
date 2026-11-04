import { DONE_VISIBLE_MS, isDone, type Task } from '@kanban/shared'
import {
  dayAndTime,
  daysUntilHidden,
  isDateable,
  quickReplies,
  type QuickReply,
} from '../lib/threads.ts'
import type { useReply } from '../lib/use-reply.ts'
import Composer from './Composer.tsx'
import QuickReplies from './QuickReplies.tsx'
import { Button } from './ui/button.tsx'

// What replaces the composer on a finished task: when it finished and, while it is still in the
// lists, how long until it leaves them, and the Reopen button.
function DoneNote({ task, now, onReopen }: { task: Task; now: number; onReopen: () => void }) {
  const at = task.doneAt
  const stamp = isDateable(at) ? ` ${dayAndTime(at, now)}` : ''
  const hidesIn = isDateable(at) && now - at < DONE_VISIBLE_MS ? daysUntilHidden(task, now) : null
  return (
    <div className="flex items-center gap-2.5">
      <p className="flex-1 py-2 text-sm text-muted-foreground">
        {`Done${stamp}.`}
        {hidesIn !== null ? ` Gone from lists in ${hidesIn} d; still in History.` : ''}
      </p>
      <Button variant="ghost" onClick={onReopen}>
        Reopen
      </Button>
    </div>
  )
}

// The bar pinned under the conversation: the quick replies while the task needs James (same
// chips as on Threads), then the composer, or the done note once the task is finished.
export default function ThreadFooter({
  task,
  now,
  reply,
  onQuickReply,
  onReopen,
}: {
  task: Task
  now: number
  reply: ReturnType<typeof useReply>
  onQuickReply: (quick: QuickReply) => void
  onReopen: () => void
}) {
  return (
    <footer className="sticky bottom-0 z-(--z-raised) border-t border-border bg-card px-4 pt-2.5 pb-safe">
      <div className="flex flex-col gap-2 pb-3">
        <QuickReplies replies={quickReplies(task)} onReply={onQuickReply} className="pt-0 pl-0" />
        {isDone(task) ? (
          <DoneNote task={task} now={now} onReopen={onReopen} />
        ) : (
          <Composer
            text={reply.text}
            onText={reply.setText}
            canSend={reply.canSend}
            onSend={reply.send}
            failed={reply.failed}
          />
        )}
      </div>
    </footer>
  )
}

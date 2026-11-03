import type { ReactNode } from 'react'
import { DONE_VISIBLE_MS, type Task } from '@kanban/shared'
import { daysUntilHidden, isDateable } from '../lib/threads.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const CLOCK_TEXT_CHARS = 5 // "HH:MM" from Date#toTimeString

// "Today 14:05", "Yesterday 09:30", "24 Oct 18:00".
function whenText(at: number, now: number): string {
  const day = new Date(at)
  const time = day.toTimeString().slice(0, CLOCK_TEXT_CHARS)
  if (day.toDateString() === new Date(now).toDateString()) return `Today ${time}`
  if (day.toDateString() === new Date(now - DAY_MS).toDateString()) return `Yesterday ${time}`
  return `${day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`
}

// What replaces the composer on a finished task: when it finished and, while it is still in the
// lists, how long until it leaves them. Reopen is B6's.
export function DoneNote({ task, now }: { task: Task; now: number }) {
  const at = task.doneAt
  const stamp = isDateable(at) ? ` ${whenText(at, now)}` : ''
  const hidesIn = isDateable(at) && now - at < DONE_VISIBLE_MS ? daysUntilHidden(task, now) : null
  return (
    <p className="py-2 text-sm text-muted-foreground">
      {`Done${stamp}.`}
      {hidesIn !== null ? ` Gone from lists in ${hidesIn} d; still in History.` : ''}
    </p>
  )
}

// The bar pinned under the conversation: the quick replies while the task needs James (same
// chips as on Threads), then the composer, or the done note once the task is finished.
export default function ThreadFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 z-(--z-raised) border-t border-border bg-card px-4 pt-2.5 pb-safe">
      <div className="flex flex-col gap-2 pb-3">{children}</div>
    </footer>
  )
}

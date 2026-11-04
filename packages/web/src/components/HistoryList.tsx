import type { LogEntry, LogWho } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import { dayAndTime, isDateable } from '../lib/threads.ts'

const WHO_LABEL: Record<LogWho, string> = { james: 'You', session: 'Session', system: 'Board' }

// Oldest first; an entry without a usable time keeps its place (the sort is stable).
const byTime = (a: LogEntry, b: LogEntry): number => Number(a.at) - Number(b.at) || 0

// Decision entries as the prototype lists them: the time on the left, then who and what. James's
// own entries are bold. The entry's text is shown as written (it may be a multi-line note).
export default function HistoryList({
  entries,
  now,
}: {
  entries: readonly LogEntry[]
  now: number
}) {
  return (
    <ol className="flex flex-col">
      {[...entries].sort(byTime).map((entry, index) => (
        <li
          key={`${entry.at}:${index}`}
          className="flex gap-3 border-b border-border py-2.5 text-sm leading-snug last:border-b-0"
        >
          <span className="w-23 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
            {isDateable(entry.at) ? dayAndTime(entry.at, now) : ''}
          </span>
          <span
            className={cn(
              'min-w-0 break-words whitespace-pre-line',
              entry.who === 'james' && 'font-bold'
            )}
          >
            <span className="font-bold text-muted-foreground">
              {`${WHO_LABEL[entry.who] ?? WHO_LABEL.system} · `}
            </span>
            {entry.text}
          </span>
        </li>
      ))}
    </ol>
  )
}

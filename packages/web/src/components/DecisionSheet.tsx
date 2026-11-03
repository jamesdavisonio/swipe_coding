import type { Task } from '@kanban/shared'
import { activeNeed } from '../lib/threads.ts'
import { Sheet, SheetContent } from './ui/sheet.tsx'

// What the sheet says under the title, from the need it was opened for.
function summaryLine(task: Task): string {
  const need = activeNeed(task)
  if (need?.kind === 'question' && need.question) return need.question
  if (need?.kind === 'spec' && task.spec?.goal) return task.spec.goal
  if (typeof task.summary === 'string' && task.summary) return task.summary
  return 'Nothing more to read on this one yet.'
}

// The decision card that slides up from "Read more" and "Open the N steps". B2 only needs it
// to open and close accessibly; the decisions themselves (approve, change request, answer,
// merged, ticks) arrive with B4. Radix handles focus trap, Escape and focus return; the close
// button comes with the sheet primitive.
export default function DecisionSheet({
  task,
  mode,
  onClose,
}: {
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent title={task.title} description={summaryLine(task)} data-mode={mode} />
    </Sheet>
  )
}

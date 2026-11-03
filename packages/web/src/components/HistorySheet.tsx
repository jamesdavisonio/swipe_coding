import type { Task } from '@kanban/shared'
import { Sheet, SheetContent } from './ui/sheet.tsx'

// The decision history of a task, behind the clock icon in the thread header. B3 only needs the
// sheet to open and close accessibly (Radix: focus trap, Escape, focus return, a titled dialog
// and a Close button); the entries and Reopen arrive with B6.
export default function HistorySheet({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        title="Decision history"
        description={`Decisions and hand-overs for ${task.title}. The chat is the conversation; this is the record.`}
      />
    </Sheet>
  )
}

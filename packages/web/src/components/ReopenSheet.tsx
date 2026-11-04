import { useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { reopenTask } from '../data.ts'
import { MAX_REOPEN_NOTE_CHARS, reopenLine, stageBeforeDone } from '../lib/reopen.ts'
import { useDecision } from '../lib/use-decision.ts'
import { useReturnFocus } from '../lib/use-return-focus.ts'
import { logMilestone } from '../lib/use-thread-actions.ts'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Textarea } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { Sheet, SheetContent } from './ui/sheet.tsx'

const EXAMPLE_AFTER_DEPLOY = 'e.g. Ticked the CNAME step by mistake, it is not live yet'
const EXAMPLE_OTHER = 'e.g. Export is missing the totals row on the production report'

// Reopen a done task with a note the session reads first. Saving closes the sheet and, unless
// James is already on the task's thread, takes him there. A refused save keeps the note.
export default function ReopenSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const [note, setNote] = useState('')
  const noteId = useId()
  const navigate = useNavigate()
  const location = useLocation()
  const returnFocus = useReturnFocus()
  const thread = `/t/${task.id}`

  const saved = () => {
    onClose()
    if (location.pathname !== thread) void navigate(thread)
  }
  const { pending, failed, decide } = useDecision(task.id, saved)
  const reopen = () =>
    void decide(
      'reopen',
      () => reopenTask(task, note),
      (requestId) => logMilestone('task_reopened', task.id, requestId)
    )

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        title="Reopen task"
        description={reopenLine(task)}
        onCloseAutoFocus={returnFocus}
      >
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-extrabold tracking-tight">{task.title}</h3>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>What is wrong, or what should happen now?</Label>
            <Textarea
              id={noteId}
              rows={4}
              maxLength={MAX_REOPEN_NOTE_CHARS}
              placeholder={
                stageBeforeDone(task) === 'after_deploy' ? EXAMPLE_AFTER_DEPLOY : EXAMPLE_OTHER
              }
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <SaveError failed={failed} />
          <div className="flex gap-2.5">
            <Button className="flex-1" disabled={pending || note.trim() === ''} onClick={reopen}>
              Reopen and send
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

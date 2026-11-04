import { useEffect, useState } from 'react'
import { LOG_CAP, isDone, type LogEntry, type Task } from '@kanban/shared'
import { useLogArchive, type Live } from '../data.ts'
import { useNow } from '../lib/use-now.ts'
import { useReturnFocus } from '../lib/use-return-focus.ts'
import HistoryList from './HistoryList.tsx'
import ReopenSheet from './ReopenSheet.tsx'
import { EmptyNote, LoadFailed, LoadingStatus } from './ScreenState.tsx'
import { Button } from './ui/button.tsx'
import { Sheet, SheetContent } from './ui/sheet.tsx'

// The entries that were archived when the task's own log filled up: loading, failed (with Retry)
// or listed.
function EarlierHistory({ archive, now }: { archive: Live<LogEntry[]>; now: number }) {
  if (archive.error !== null)
    return <LoadFailed title="Couldn't load earlier history" failed={[archive]} className="p-4" />
  if (archive.loading) return <LoadingStatus label="Loading earlier history" className="p-4" />
  return <HistoryList entries={archive.data} now={now} />
}

// The decision history of a task, behind the clock icon in the thread header and a Done card's
// History button: decisions, hand-overs and reopens, oldest first, with when and by whom. The
// chat is not in it. Once the log has filled up, "Show earlier history" reads what was archived.
// A done task offers Reopen task, which opens the Reopen sheet over this one; when the task is
// reopened (here or elsewhere) this sheet has done its job and closes. Opening it is not logged.
export default function HistorySheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const now = useNow()
  const returnFocus = useReturnFocus()
  const [earlier, setEarlier] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [openedDone] = useState(isDone(task))
  const archive = useLogArchive(task.id, earlier)
  const entries = Array.isArray(task.log) ? task.log : []
  const done = isDone(task)

  useEffect(() => {
    if (openedDone && !done) onClose()
  }, [openedDone, done, onClose])

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          title="Decision history"
          description="Decisions and hand-overs only, kept for as long as the task exists. The chat is the conversation; this is the record."
          onCloseAutoFocus={returnFocus}
        >
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-extrabold tracking-tight">{task.title}</h3>
            {entries.length >= LOG_CAP && !earlier ? (
              <Button variant="outline" className="self-center" onClick={() => setEarlier(true)}>
                Show earlier history
              </Button>
            ) : null}
            {earlier ? <EarlierHistory archive={archive} now={now} /> : null}
            {entries.length === 0 ? (
              <EmptyNote>Nothing recorded yet.</EmptyNote>
            ) : (
              <HistoryList entries={entries} now={now} />
            )}
            {done ? (
              <Button variant="outline" block onClick={() => setReopening(true)}>
                Reopen task
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      {reopening ? <ReopenSheet task={task} onClose={() => setReopening(false)} /> : null}
    </>
  )
}

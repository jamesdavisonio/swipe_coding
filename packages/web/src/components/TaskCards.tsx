import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TASK_TYPE_LABELS, type Task } from '@kanban/shared'
import { activeNeed, isDateable, relativeTime, stageText, stepCount } from '../lib/threads.ts'
import HistorySheet from './HistorySheet.tsx'
import ReopenSheet from './ReopenSheet.tsx'
import StageStepper from './StageStepper.tsx'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'

const CARD_BOX = 'rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm'
const CARD_LINK =
  'flex flex-col gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

// A task still in flight on a project's Live tab: its type, where it is (highlighted while it
// needs James), the title, the stage stepper and a note when after-deploy steps wait at the end.
export function LiveTaskCard({ task }: { task: Task }) {
  const steps = stepCount(task)
  return (
    <li>
      <Link to={`/t/${task.id}`} className={`${CARD_BOX} ${CARD_LINK}`}>
        <div className="flex items-center justify-between gap-2">
          <Badge>{TASK_TYPE_LABELS[task.type] ?? task.type}</Badge>
          <Badge variant={activeNeed(task) ? 'needs' : 'quiet'}>{stageText(task)}</Badge>
        </div>
        <div className="text-lg font-extrabold">{task.title}</div>
        <StageStepper task={task} />
        {steps > 0 ? (
          <div className="text-xs text-muted-foreground">
            {`${steps} after-deploy ${steps === 1 ? 'step' : 'steps'} for you at the end`}
          </div>
        ) : null}
      </Link>
    </li>
  )
}

// A finished task on the Done tab: title, the session's summary and when it finished, then its
// History and Reopen buttons (beside the link, not inside it, so each is a control of its own).
export function DoneTaskCard({ task, now }: { task: Task; now: number }) {
  const [sheet, setSheet] = useState<'history' | 'reopen' | null>(null)
  const summary = typeof task.summary === 'string' ? task.summary : ''
  const close = () => setSheet(null)
  return (
    <li className={`${CARD_BOX} flex flex-col gap-1`}>
      <Link to={`/t/${task.id}`} className={CARD_LINK}>
        <div className="text-lg font-extrabold">{task.title}</div>
        {summary ? <div className="text-muted-foreground">{summary}</div> : null}
        {isDateable(task.doneAt) ? (
          <div className="text-xs text-muted-foreground">
            {`done ${relativeTime(task.doneAt, now)}`}
          </div>
        ) : null}
      </Link>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          aria-label={`History of ${task.title}`}
          onClick={() => setSheet('history')}
        >
          History
        </Button>
        <Button
          variant="ghost"
          aria-label={`Reopen ${task.title}`}
          onClick={() => setSheet('reopen')}
        >
          Reopen
        </Button>
      </div>
      {sheet === 'history' ? <HistorySheet task={task} onClose={close} /> : null}
      {sheet === 'reopen' ? <ReopenSheet task={task} onClose={close} /> : null}
    </li>
  )
}

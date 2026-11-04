import { Link } from 'react-router-dom'
import { TASK_TYPE_LABELS, type Task } from '@kanban/shared'
import { activeNeed, isDateable, relativeTime, stageText, stepCount } from '../lib/threads.ts'
import StageStepper from './StageStepper.tsx'
import { Badge } from './ui/badge.tsx'

const CARD =
  'flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

// A task still in flight on a project's Live tab: its type, where it is (highlighted while it
// needs James), the title, the stage stepper and a note when after-deploy steps wait at the end.
export function LiveTaskCard({ task }: { task: Task }) {
  const steps = stepCount(task)
  return (
    <li>
      <Link to={`/t/${task.id}`} className={CARD}>
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

// A finished task on the Done tab: title, the session's summary and when it finished.
export function DoneTaskCard({ task, now }: { task: Task; now: number }) {
  const summary = typeof task.summary === 'string' ? task.summary : ''
  return (
    <li>
      <Link to={`/t/${task.id}`} className={CARD}>
        <div className="text-lg font-extrabold">{task.title}</div>
        {summary ? <div className="text-muted-foreground">{summary}</div> : null}
        {isDateable(task.doneAt) ? (
          <div className="text-xs text-muted-foreground">
            {`done ${relativeTime(task.doneAt, now)}`}
          </div>
        ) : null}
      </Link>
    </li>
  )
}

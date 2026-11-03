import { STAGE_LABEL, isDone, type Task } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import { Check } from '../lib/icons.ts'
import { stagesOf } from '../lib/messages.ts'

// The task's stage chain as a row of dots: finished stages are green with a tick, the current
// one has a ring, the rest are empty; a connector joins each dot to the one before it and is
// green once both are finished. Each dot shares its grid column with its label so they cannot
// drift apart. A done task has no current stage; neither has a task whose stage is not in its
// chain; a For James task has no chain and no stepper.
export default function StageStepper({ task }: { task: Task }) {
  const chain = stagesOf(task)
  if (chain.length === 0) return null
  const done = isDone(task)
  const current = chain.indexOf(task.stage)
  return (
    <ol
      aria-label="Stages"
      className="grid"
      style={{ gridTemplateColumns: `repeat(${chain.length}, minmax(0, 1fr))` }}
    >
      {chain.map((stage, i) => {
        const finished = done || i < current
        const isCurrent = !done && i === current
        const linked = finished && i > 0
        return (
          <li
            key={stage}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-1',
              'before:absolute before:top-2.5 before:right-1/2 before:h-0.5 before:w-full before:bg-border',
              'first:before:hidden',
              linked && 'before:bg-ok'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'relative z-(--z-raised) flex size-5.5 shrink-0 items-center justify-center rounded-full border-2',
                finished && 'border-ok bg-ok text-ok-foreground',
                isCurrent && 'border-needs bg-card',
                !finished && !isCurrent && 'border-border bg-card'
              )}
            >
              {finished ? <Check className="size-3.5" strokeWidth={3} /> : null}
              {isCurrent ? <span className="size-2 rounded-full bg-needs" /> : null}
            </span>
            <span
              className={cn(
                'max-w-full text-center text-2xs leading-tight font-bold',
                finished || isCurrent ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {STAGE_LABEL[stage]}
              {finished ? <span className="sr-only"> (completed)</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

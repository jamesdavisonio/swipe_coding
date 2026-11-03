import type { Task } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import { useStepTicks } from '../lib/use-step-ticks.ts'
import SaveError from './SaveError.tsx'
import { SheetContent } from './ui/sheet.tsx'

// The after-deploy checklist. Each step is a whole 44 px row: tap the box or the words. The
// task closes itself once the last step is ticked (the write does it), and the parent then
// drops this sheet because the need is gone.
export default function AfterDeployDecision({
  task,
  returnFocus,
}: {
  task: Task
  returnFocus: (event: Event) => void
}) {
  const { steps, checked, tick, failed } = useStepTicks(task)

  return (
    <SheetContent
      onCloseAutoFocus={returnFocus}
      title="Deployed. Your steps:"
      aria-describedby={undefined}
    >
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col rounded-lg border border-border">
          {steps.map((step, index) => (
            <li key={step} className="border-b border-border last:border-b-0">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-7 shrink-0 accent-ok focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  checked={checked(index)}
                  onChange={() => void tick(index)}
                />
                <span
                  className={cn('flex-1', checked(index) && 'text-muted-foreground line-through')}
                >
                  {step}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <SaveError failed={failed} />
        <p className="text-sm text-muted-foreground">
          The task closes itself when every step is ticked.
        </p>
      </div>
    </SheetContent>
  )
}

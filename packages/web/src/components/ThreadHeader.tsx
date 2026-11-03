import { useLocation, useNavigate } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { ArrowLeft, Clock } from '../lib/icons.ts'
import { stageText } from '../lib/threads.ts'
import StageStepper from './StageStepper.tsx'
import { Button } from './ui/button.tsx'

// Back goes to the Threads path James came from (project filter included) when the navigation
// state carries one; only an in-app path counts, never another site, and anything else
// (opened directly, a malformed state) goes to Threads.
function backTarget(state: unknown): string {
  const from =
    typeof state === 'object' && state !== null ? (state as { from?: unknown }).from : null
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

// The sticky top of a thread: Back, the title with "<project> · <stage>" under it (plus
// "session live" while the project's session is online), the History button and the stepper.
export default function ThreadHeader({
  task,
  projectName,
  live,
  onHistory,
}: {
  task: Task
  projectName: string | null
  live: boolean
  onHistory: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const state: unknown = location.state
  const sub = [projectName, stageText(task), live ? 'session live' : null]
    .filter((part) => part !== null)
    .join(' · ')
  return (
    <header className="sticky top-0 z-(--z-sticky) flex flex-col gap-2 bg-background px-4 pt-safe pb-2.5">
      <div className="flex items-center gap-1 pt-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to threads"
          className="-ml-3"
          onClick={() => void navigate(backTarget(state))}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight">{task.title}</h1>
          <p className="truncate text-xs font-semibold text-muted-foreground">{sub}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Decision history"
          className="-mr-3 text-muted-foreground"
          onClick={onHistory}
        >
          <Clock aria-hidden="true" />
        </Button>
      </div>
      <StageStepper task={task} />
    </header>
  )
}

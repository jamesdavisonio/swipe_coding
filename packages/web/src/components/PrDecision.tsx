import type { Task } from '@kanban/shared'
import { markMerged } from '../data.ts'
import { ExternalLink } from '../lib/icons.ts'
import { webUrl } from '../lib/threads.ts'
import { useDecision } from '../lib/use-decision.ts'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { SheetContent } from './ui/sheet.tsx'

// The PR decision: the session's summary, the PR in GitHub (web links only, new tab) and Merged it.
export default function PrDecision({
  task,
  close,
  returnFocus,
}: {
  task: Task
  close: () => void
  returnFocus: (event: Event) => void
}) {
  const { pending, failed, decide } = useDecision(task.id, close)
  const href = webUrl(task.pr?.url)
  const title = task.pr ? `PR #${task.pr.number} is ready to merge` : 'PR is ready to merge'

  return (
    <SheetContent onCloseAutoFocus={returnFocus} title={title} aria-describedby={undefined}>
      <div className="flex flex-col gap-4">
        {task.summary ? <p className="text-base leading-relaxed">{task.summary}</p> : null}
        <SaveError failed={failed} />
        {href && task.pr ? (
          <Button asChild variant="ok" block>
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open PR #{task.pr.number} in GitHub
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        <Button
          variant="outline"
          block
          disabled={pending}
          onClick={() => void decide('merged', () => markMerged(task))}
        >
          Merged it
        </Button>
      </div>
    </SheetContent>
  )
}

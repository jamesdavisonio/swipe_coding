import { useId, useState } from 'react'
import type { Task, TaskSpec } from '@kanban/shared'
import { approveSpec, requestChange } from '../data.ts'
import { MAX_COMMENT_CHARS } from '../lib/limits.ts'
import { specVersion } from '../lib/threads.ts'
import { useDecision } from '../lib/use-decision.ts'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Textarea } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { SheetContent } from './ui/sheet.tsx'

// What the spec says: goal, points, out of scope, touches. A task whose spec has not arrived
// yet (or is half-migrated) says so instead of showing an empty card.
function SpecBody({ spec }: { spec: TaskSpec | null }) {
  if (!spec) return <p>The session hasn't attached the spec yet.</p>
  const points = Array.isArray(spec.points) ? spec.points : []
  return (
    <div className="flex flex-col gap-2 text-base leading-relaxed">
      <p>
        <strong>Goal.</strong> {spec.goal}
      </p>
      {points.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      {spec.out ? (
        <p>
          <strong>Out of scope.</strong> {spec.out}
        </p>
      ) : null}
      {spec.touches ? (
        <p className="text-sm text-muted-foreground">
          <strong>Touches:</strong> {spec.touches}
        </p>
      ) : null}
    </div>
  )
}

// The spec decision: Approve vN, or Changes… with free text that goes to the session.
export default function SpecDecision({
  task,
  mode,
  close,
  returnFocus,
}: {
  task: Task
  mode: 'read' | 'change'
  close: () => void
  returnFocus: (event: Event) => void
}) {
  const [changing, setChanging] = useState(mode === 'change')
  const [text, setText] = useState('')
  const { pending, failed, decide } = useDecision(task.id, close)
  const boxId = useId()
  const version = specVersion(task)

  return (
    <SheetContent
      onCloseAutoFocus={returnFocus}
      title={`Spec v${version} — ${task.title}`}
      aria-describedby={undefined}
    >
      <div className="flex flex-col gap-4">
        <SpecBody spec={task.spec} />
        {changing ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={boxId}>What should change?</Label>
            <Textarea
              id={boxId}
              rows={3}
              maxLength={MAX_COMMENT_CHARS}
              placeholder="e.g. Also add a totals row at the bottom"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        ) : null}
        <SaveError failed={failed} />
        {changing ? (
          <div className="flex gap-2.5">
            <Button
              className="flex-1"
              disabled={pending || text.trim() === ''}
              onClick={() => void decide('request_change', () => requestChange(task, text))}
            >
              Send to session
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setChanging(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() => void decide('approve_spec', () => approveSpec(task))}
            >
              Approve v{version}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setChanging(true)}
            >
              Changes…
            </Button>
          </div>
        )}
      </div>
    </SheetContent>
  )
}

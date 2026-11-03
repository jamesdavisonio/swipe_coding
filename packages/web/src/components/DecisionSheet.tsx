import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from '@kanban/shared'
import { rememberFocus } from '../lib/a11y.ts'
import { activeNeed } from '../lib/threads.ts'
import AfterDeployDecision from './AfterDeployDecision.tsx'
import PrDecision from './PrDecision.tsx'
import QuestionDecision from './QuestionDecision.tsx'
import SpecDecision from './SpecDecision.tsx'
import { Sheet } from './ui/sheet.tsx'

// The decision card that slides up from "Read more", "Small change…" and "Open the N steps": the
// spec, the question, the PR or the after-deploy steps, whichever the task needs. It is made for
// the need the task had when it opened and closes itself (onClose) once the task has moved on,
// however that happened (this sheet, another device, the session). Radix gives it the focus trap,
// Escape and the return of focus to the control that opened it.
export default function DecisionSheet({
  task,
  mode,
  onClose,
}: {
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}) {
  const need = activeNeed(task)
  const [openedFor] = useState(need?.kind)
  const [restoreFocus] = useState(rememberFocus)
  const closed = useRef(false)
  const close = useCallback(() => {
    if (closed.current) return
    closed.current = true
    onClose()
  }, [onClose])

  // Radix only knows how to hand focus back to a Dialog.Trigger; this sheet is opened by chips
  // and buttons elsewhere, so the control that had focus when it opened gets it back.
  const returnFocus = (event: Event) => {
    event.preventDefault()
    restoreFocus()
  }

  const moved = !need || need.kind !== openedFor
  useEffect(() => {
    if (moved) close()
  }, [moved, close])
  if (!need || moved) return null

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      {need.kind === 'spec' ? (
        <SpecDecision task={task} mode={mode} close={close} returnFocus={returnFocus} />
      ) : null}
      {need.kind === 'question' ? (
        <QuestionDecision task={task} need={need} close={close} returnFocus={returnFocus} />
      ) : null}
      {need.kind === 'pr' ? (
        <PrDecision task={task} close={close} returnFocus={returnFocus} />
      ) : null}
      {need.kind === 'after_deploy' ? (
        <AfterDeployDecision task={task} returnFocus={returnFocus} />
      ) : null}
    </Sheet>
  )
}

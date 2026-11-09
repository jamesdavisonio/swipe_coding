// The deck's New session button, bottom right of the dock: a plus the size of the to-do button.
// It opens the New session sheet (docs/features/launch-session.md).
import type { Ref } from 'react'
import { Plus } from '../../lib/icons.ts'

export default function NewSessionButton({
  onOpen,
  ref,
}: {
  onOpen: () => void
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="New session"
      aria-haspopup="dialog"
      onClick={onOpen}
      className="grid size-14 place-items-center rounded-xl border border-border bg-card text-foreground"
    >
      <Plus aria-hidden="true" className="size-6" />
    </button>
  )
}

// The deck's to-do button, bottom left of the dock: a list on the to-do tint, with a badge counting
// the to-dos still open across every project (none open, no badge). It opens the to-do drawer.
import type { Ref } from 'react'
import { ListTodo } from '../../lib/icons.ts'

export default function TodoButton({
  open,
  onOpen,
  ref,
}: {
  open: number
  onOpen: () => void
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`To-dos, ${open > 0 ? open : 'none'} open`}
      aria-haspopup="dialog"
      onClick={onOpen}
      className="relative grid size-14 place-items-center rounded-xl bg-tone-todo text-tone-todo-foreground"
    >
      <ListTodo aria-hidden="true" className="size-6" />
      {open > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 grid h-5.5 min-w-5.5 place-items-center rounded-full bg-foreground px-1.5 text-xs font-bold text-background tabular-nums">
          {open}
        </span>
      ) : null}
    </button>
  )
}

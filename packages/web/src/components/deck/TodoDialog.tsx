// One to-do, opened from its row in the drawer: a dialog above the sheet with the project and how
// long ago it was added, the full text, the task it came from, its web link, and the tick. It is
// the top layer: its own portal after the sheet's, so nothing of the sheet (the tapped row's focus
// ring or tap highlight) is drawn over it, and focus moves into it. Closing it (✕, a tap outside,
// Escape) leaves the sheet open and hands focus back to the row.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ExternalLink, X } from '../../lib/icons.ts'
import { closeAndFocus } from '../../lib/use-return-focus.ts'
import { relativeTime, webUrl } from '../../lib/threads.ts'
import type { TodoRow } from '../../lib/todo-drawer.ts'
import { Button } from '../ui/button.tsx'

export default function TodoDialog({
  row,
  projectName,
  now,
  onToggle,
  onClose,
  returnFocus,
}: {
  row: TodoRow
  projectName: string
  now: number
  onToggle: () => void
  onClose: () => void
  returnFocus: () => void
}) {
  const { todo, taskTitle } = row
  const href = webUrl(todo.link)
  const close = () => closeAndFocus(onClose, returnFocus)
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="sheet-backdrop"
          onClick={close}
          className="fixed inset-0 z-(--z-modal) bg-foreground/40"
        />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus()
          }}
          className="fixed inset-x-4 top-1/2 z-(--z-modal) mx-auto grid max-h-[80dvh] max-w-md -translate-y-1/2 gap-3.5 overflow-y-auto rounded-xl bg-card p-5 text-card-foreground shadow-xl outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="pt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {`${projectName} · ${relativeTime(todo.createdAt, now)}`}
            </p>
            <DialogPrimitive.Close
              aria-label="Close this to-do"
              className="-mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-muted"
            >
              <X aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="text-lg leading-normal font-medium break-words">
            {todo.body}
          </DialogPrimitive.Title>
          {taskTitle || href ? (
            <div className="grid gap-1 text-sm text-muted-foreground">
              {taskTitle ? <p>{`From: ${taskTitle}`}</p> : null}
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 break-all text-primary underline-offset-2 hover:underline"
                >
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  {href}
                </a>
              ) : null}
            </div>
          ) : null}
          <Button block onClick={onToggle} className="h-12 rounded-full">
            {todo.done ? 'Mark not done' : 'Mark done'}
          </Button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

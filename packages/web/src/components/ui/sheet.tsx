import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { X } from '../../lib/icons.ts'

// The bottom sheet from the prototype ("Read more" → decision card, reopen note, new task).
// Radix Dialog underneath: focus trap, focus restore, Escape, aria-modal, scroll lock.
// Every sheet has a title (announced on open); description is optional.

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export interface SheetContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  title: ReactNode
  description?: ReactNode
  // Label for the close button; defaults to "Close".
  closeLabel?: string
}

export function SheetContent({
  className,
  children,
  title,
  description,
  closeLabel = 'Close',
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-(--z-overlay) bg-foreground/40"
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-(--z-modal) mx-auto flex max-h-[90dvh] w-full max-w-(--content-max) flex-col',
          'rounded-t-xl border-t border-border bg-card text-card-foreground shadow-lg outline-none pb-safe',
          className
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex items-start gap-3 px-4 pt-3">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-lg font-extrabold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={closeLabel}
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

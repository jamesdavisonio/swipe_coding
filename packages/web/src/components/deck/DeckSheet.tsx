// A deck sheet: from the bottom (details, choices, skip, hold, voice, listen) or the top (overview).
// Radix Dialog underneath for the dialog role, focus trap and Escape; it closes with its ✕, a tap
// on the dim layer, Escape, or a drag back the way it came from anywhere on it. The listen sheet
// is not modal: the deck stays usable while it reads.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { X } from '../../lib/icons.ts'
import { useReturnFocus } from '../../lib/use-return-focus.ts'
import { useSheetDrag, type SheetSide } from './use-sheet-drag.ts'

function Grab() {
  return (
    <div aria-hidden="true" className="grid min-h-7 shrink-0 cursor-grab place-items-center">
      <span className="h-1 w-11 rounded-full bg-border" />
    </div>
  )
}

export default function DeckSheet({
  side = 'bottom',
  eyebrow,
  title,
  modal = true,
  className,
  onClose,
  children,
}: {
  side?: SheetSide
  eyebrow?: ReactNode
  // The sheet's heading and accessible name.
  title: ReactNode
  modal?: boolean
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const sheet = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const returnFocus = useReturnFocus()
  const { offset, handlers } = useSheetDrag({ side, scroll, sheet, onClose })
  const style = {
    transform: offset === null ? undefined : `translateY(${offset}px)`,
    '--drag-y': `${offset ?? 0}px`,
  } as CSSProperties

  return (
    <DialogPrimitive.Root open modal={modal} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {modal ? (
          <DialogPrimitive.Overlay
            data-slot="deck-backdrop"
            data-testid="sheet-backdrop"
            onClick={onClose}
            className="fixed inset-0 z-(--z-overlay) bg-foreground/40"
          />
        ) : null}
        <DialogPrimitive.Content
          ref={sheet}
          data-slot="deck-sheet"
          data-side={side}
          aria-describedby={undefined}
          onCloseAutoFocus={returnFocus}
          // A non-modal sheet stays while James uses the deck; only its own controls close it.
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          className={cn(
            'fixed inset-x-0 z-(--z-modal) mx-auto flex max-h-[88dvh] w-full max-w-(--content-max) flex-col',
            'bg-card text-card-foreground shadow-xl outline-none',
            side === 'bottom'
              ? 'bottom-0 rounded-t-deck-sheet pb-safe'
              : 'top-0 rounded-b-deck-sheet pt-safe',
            offset === null && 'transition-transform duration-(--motion-slow) ease-out',
            className
          )}
          style={style}
          {...handlers}
        >
          {side === 'bottom' ? <Grab /> : null}
          <div
            ref={scroll}
            data-testid="sheet-scroll"
            className={cn(
              'min-h-0 overflow-y-auto overscroll-contain px-5 pb-5',
              side === 'top' && 'pt-4'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {eyebrow}
                  </p>
                ) : null}
                <DialogPrimitive.Title className="mt-1.5 mb-4 text-2xl leading-tight font-extrabold tracking-tight text-balance">
                  {title}
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close
                aria-label="Close"
                className="-mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border border-border"
              >
                <X aria-hidden="true" className="size-5" />
              </DialogPrimitive.Close>
            </div>
            {children}
          </div>
          {side === 'top' ? <Grab /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// A deck sheet: from the bottom (details, choices, skip, voice, listen) or the top (overview).
// Radix Dialog underneath for the dialog role, focus trap and Escape; it closes with its ✕, a tap
// on the dim layer, Escape, or a drag back the way it came from anywhere on it. The listen sheet
// is not modal: the deck stays usable while it reads. A sheet with a long list pins its header, so
// its title and ✕ stay in view while the list scrolls.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { X } from '../../lib/icons.ts'
import { closeAndFocus, useReturnFocus } from '../../lib/use-return-focus.ts'
import { useSheetDrag, type SheetSide } from './use-sheet-drag.ts'

function Grab() {
  return (
    <div aria-hidden="true" className="grid min-h-7 shrink-0 cursor-grab place-items-center">
      <span className="h-1 w-11 rounded-full bg-border" />
    </div>
  )
}

// The eyebrow, the title (the sheet's name), an optional line under it, and the ✕. Pinned, it sits
// above the scrolling part with a rule under it.
function Header({
  eyebrow,
  title,
  summary,
  closeLabel,
  pinned,
}: {
  eyebrow: ReactNode
  title: ReactNode
  summary: ReactNode
  closeLabel: string
  pinned: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        pinned && 'shrink-0 border-b border-muted px-5 pb-3'
      )}
    >
      <div className={cn('min-w-0', !pinned && 'mb-4')}>
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <DialogPrimitive.Title className="mt-1.5 text-2xl leading-tight font-extrabold tracking-tight text-balance">
          {title}
        </DialogPrimitive.Title>
        {summary ? <p className="mt-0.5 text-sm text-muted-foreground">{summary}</p> : null}
      </div>
      <DialogPrimitive.Close
        aria-label={closeLabel}
        className="-mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border border-border"
      >
        <X aria-hidden="true" className="size-5" />
      </DialogPrimitive.Close>
    </div>
  )
}

export default function DeckSheet({
  side = 'bottom',
  eyebrow,
  title,
  summary,
  closeLabel = 'Close',
  pinHeader = false,
  modal = true,
  className,
  onClose,
  returnFocus,
  children,
}: {
  side?: SheetSide
  eyebrow?: ReactNode
  // The sheet's heading and accessible name.
  title: ReactNode
  // A line under the title.
  summary?: ReactNode
  closeLabel?: string
  pinHeader?: boolean
  modal?: boolean
  className?: string
  onClose: () => void
  // Where focus goes once the sheet has closed; by default, back to what had it when it opened.
  returnFocus?: () => void
  children: ReactNode
}) {
  const sheet = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const restoreFocus = useReturnFocus()
  // With a given place for focus, it goes there as the sheet closes; otherwise Radix's close
  // hands it back to whatever had it when the sheet opened.
  const close = returnFocus ? () => closeAndFocus(onClose, returnFocus) : onClose
  const onCloseAutoFocus = (event: Event) => {
    if (!returnFocus) return restoreFocus(event)
    event.preventDefault()
    returnFocus()
  }
  const { offset, handlers } = useSheetDrag({ side, scroll, sheet, onClose: close })
  const header = (
    <Header
      eyebrow={eyebrow}
      title={title}
      summary={summary}
      closeLabel={closeLabel}
      pinned={pinHeader}
    />
  )
  const style = {
    transform: offset === null ? undefined : `translateY(${offset}px)`,
    '--drag-y': `${offset ?? 0}px`,
  } as CSSProperties

  return (
    <DialogPrimitive.Root open modal={modal} onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        {/* One layer for the dim and the sheet: a dialog opened above the sheet hides this layer
            from assistive tech, not the sheet itself, which keeps its name. */}
        <div data-slot="deck-layer">
          {modal ? (
            <DialogPrimitive.Overlay
              data-slot="deck-backdrop"
              data-testid="sheet-backdrop"
              onClick={close}
              className="fixed inset-0 z-(--z-overlay) bg-foreground/40"
            />
          ) : null}
          <DialogPrimitive.Content
            ref={sheet}
            data-slot="deck-sheet"
            data-side={side}
            aria-describedby={undefined}
            aria-modal={modal || undefined}
            onCloseAutoFocus={onCloseAutoFocus}
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
            {pinHeader ? header : null}
            <div
              ref={scroll}
              data-testid="sheet-scroll"
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain px-5 pb-5',
                side === 'top' && 'pt-4',
                pinHeader && 'pt-2'
              )}
            >
              {pinHeader ? null : header}
              {children}
            </div>
            {side === 'top' ? <Grab /> : null}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

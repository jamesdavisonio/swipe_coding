// The bottom dock: only the big microphone ("Change it") shows, as on the screen James approved;
// a swipe's stamp is the only other sign of a move. Later and Agree are still buttons for the
// keyboard, switch access and screen readers: visually hidden until they take keyboard focus,
// then shown beside the mic with the focus ring.
import { srOnly } from '../../lib/a11y.ts'
import { cn } from '../../lib/cn.ts'
import { Check, Clock, Mic, type LucideIcon } from '../../lib/icons.ts'

// The button stays sr-only (1px, clipped) until focused; its look lives on the inner span so the
// hidden state never fights the 56px size.
function HiddenMove({
  label,
  Icon,
  disabled,
  onClick,
}: {
  label: string
  Icon: LucideIcon
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(srOnly, 'rounded-full focus-visible:not-sr-only')}
    >
      <span className="grid size-14 place-items-center rounded-full border border-border bg-card">
        <Icon aria-hidden="true" className="size-6" />
      </span>
    </button>
  )
}

export default function DeckDock({
  hasCard,
  canChange,
  onLater,
  onAgree,
  onChange,
}: {
  hasCard: boolean
  canChange: boolean
  onLater: () => void
  onAgree: () => void
  onChange: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-7 pt-3 pb-4">
      <HiddenMove label="Later" Icon={Clock} disabled={!hasCard} onClick={onLater} />
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label="Change it"
          disabled={!canChange}
          onClick={onChange}
          className="grid size-21 place-items-center rounded-full bg-me text-me-foreground shadow-xl disabled:opacity-50"
        >
          <Mic aria-hidden="true" className="size-8" />
        </button>
        <small aria-hidden="true" className="text-xs text-muted-foreground">
          Change it
        </small>
      </div>
      <HiddenMove label="Agree" Icon={Check} disabled={!hasCard} onClick={onAgree} />
    </div>
  )
}

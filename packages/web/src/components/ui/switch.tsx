import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

// An on/off control: a button with role="switch" whose label (and optional leading icon) sits
// beside a track and thumb. A full-width row at least 44px tall; the focus ring is the button's.
export function Switch({
  checked,
  disabled = false,
  busy = false,
  icon,
  onToggle,
  className,
  children,
}: {
  checked: boolean
  disabled?: boolean
  // A change is under way: the switch ignores taps until it ends.
  busy?: boolean
  icon?: ReactNode
  onToggle: () => void
  className?: string
  // The switch's visible label and accessible name.
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => {
        if (!busy) onToggle()
      }}
      className={cn(
        'flex min-h-(--tap-min) w-full items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left font-medium',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
        className
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-(--motion-fast)',
          checked ? 'bg-primary' : 'bg-muted-foreground'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-card shadow-sm transition-transform duration-(--motion-fast)',
            checked && 'translate-x-4'
          )}
        />
      </span>
    </button>
  )
}

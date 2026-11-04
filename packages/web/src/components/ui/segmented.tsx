import { cn } from '../../lib/cn.ts'

// A row of mutually exclusive choices (the prototype's .seg): each is a button with aria-pressed,
// the chosen one raised on the card colour. Used for a project's tabs and New task's type.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: readonly { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex gap-1 rounded-md bg-muted p-1', className)}
    >
      {options.map((option) => {
        const pressed = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.id)}
            className={cn(
              'h-11 min-w-0 flex-1 truncate rounded-sm px-2 text-sm font-bold',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              pressed ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

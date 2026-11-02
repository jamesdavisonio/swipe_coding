import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn.ts'

// Status pills and counters from the prototype. Colour never carries the meaning alone:
// the text inside does ("Needs you", "Done", "3").
export const badgeVariants = cva(
  'inline-flex h-6 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 text-xs font-bold',
  {
    variants: {
      variant: {
        needs: 'bg-needs-soft text-needs',
        ok: 'bg-ok-soft text-ok',
        me: 'bg-primary-soft text-primary',
        quiet: 'bg-muted text-muted-foreground',
        count: 'min-w-6 rounded-full bg-needs px-1.5 text-needs-foreground',
        'count-me': 'min-w-6 rounded-full bg-primary px-1.5 text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'quiet' },
  }
)

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

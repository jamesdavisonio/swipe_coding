import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn.ts'

// Variants mirror the prototype: primary = ink, accent = brand blue, ok = green,
// outline/ghost for secondary actions. Default height is the 44px tap minimum.
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold ' +
    'transition-[background-color,transform] duration-(--motion-fast) ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-me text-me-foreground hover:bg-me/90',
        accent: 'bg-primary text-primary-foreground hover:bg-primary/90',
        ok: 'bg-ok text-ok-foreground hover:bg-ok/90',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
      },
      size: {
        md: 'h-11 px-4 text-base',
        sm: 'h-9 rounded-sm px-3 text-sm',
        icon: 'size-11',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  // Render the child element (e.g. a router <Link>) with the button's styles instead of a <button>.
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  )
}

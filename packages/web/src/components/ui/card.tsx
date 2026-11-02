import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn.ts'

// A surface. Thread rows and decision cards in the prototype are Cards with custom content.
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1', className)} {...props} />
}

// A real heading so screen readers can jump between cards; `as` picks the level.
export function CardTitle({
  className,
  children,
  as: Tag = 'h3',
  ...props
}: ComponentProps<'h3'> & { as?: 'h2' | 'h3' | 'h4' }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn('text-lg leading-tight font-extrabold tracking-tight', className)}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('flex flex-col gap-2', className)} {...props} />
  )
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="card-footer" className={cn('flex items-center gap-2', className)} {...props} />
  )
}

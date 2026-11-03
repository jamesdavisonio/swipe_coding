import type { QuickReply } from '../lib/threads.ts'
import { cn } from '../lib/cn.ts'
import { Button } from './ui/button.tsx'
import { ExternalLink } from '../lib/icons.ts'

// The chips under a row that needs James. The first one is the primary action (ink); the
// rest are outlined. A PR link opens in a new tab, everything else is a button.
export default function QuickReplies({
  replies,
  onReply,
  className,
}: {
  replies: QuickReply[]
  onReply: (reply: QuickReply) => void
  // Extra classes for the row; the default indent lines the chips up with a thread row's text.
  className?: string
}) {
  if (replies.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-2 pt-1.5 pl-15', className)}>
      {replies.map((reply, index) => {
        const variant = index === 0 ? 'primary' : 'outline'
        const pill = 'rounded-full px-4 text-sm'
        if (reply.kind === 'pr_link')
          return (
            <Button key={reply.label} asChild variant={variant} className={pill}>
              <a href={reply.href} target="_blank" rel="noopener noreferrer">
                {reply.label}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          )
        return (
          <Button
            key={reply.label}
            variant={variant}
            className={pill}
            onClick={() => onReply(reply)}
          >
            {reply.label}
          </Button>
        )
      })}
    </div>
  )
}

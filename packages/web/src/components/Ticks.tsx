import { deliveryState, type Comment, type DeliveryState } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import { Check, CheckCheck } from '../lib/icons.ts'

// One tick = sent; two grey = received by the session; two coloured = the session is working
// on it, or has handled it. The word always travels with the ticks (colour never carries it).
const TICK_LABEL: Record<DeliveryState, string> = {
  sent: 'sent',
  delivered: 'received',
  working: 'working on it',
  handled: 'handled',
}
const COLOURED: readonly DeliveryState[] = ['working', 'handled']

export default function Ticks({
  comment,
}: {
  comment: Pick<Comment, 'deliveredAt' | 'workingAt' | 'handledAt'>
}) {
  const state = deliveryState(comment)
  const Icon = state === 'sent' ? Check : CheckCheck
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        COLOURED.includes(state) ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {TICK_LABEL[state]}
    </span>
  )
}

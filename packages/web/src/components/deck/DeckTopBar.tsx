// The deck's top: the count pill (opens the overview) and the speaker (reads the card aloud,
// hidden where the browser cannot speak).
import { useId } from 'react'
import { ChevronDown, Volume2 } from '../../lib/icons.ts'

function countText(total: number, allPassed: boolean): string {
  if (total === 0) return 'All clear'
  return `${total} left${allPassed ? ' · all passed once' : ''}`
}

export default function DeckTopBar({
  total,
  allPassed,
  canListen,
  speaking,
  onOverview,
  onListen,
}: {
  total: number
  allPassed: boolean
  canListen: boolean
  speaking: boolean
  onOverview: () => void
  onListen: () => void
}) {
  const countId = useId()
  return (
    <header className="flex items-center justify-between gap-3 pt-3 pb-2.5">
      <button
        type="button"
        aria-label="Overview"
        aria-describedby={countId}
        onClick={onOverview}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 font-semibold tabular-nums"
      >
        <span id={countId}>{countText(total, allPassed)}</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      {canListen ? (
        <button
          type="button"
          aria-label="Listen"
          aria-pressed={speaking}
          disabled={total === 0}
          onClick={onListen}
          className="grid size-11 place-items-center rounded-full border border-border bg-card aria-pressed:bg-foreground aria-pressed:text-background disabled:opacity-50"
        >
          <Volume2 aria-hidden="true" className="size-5" />
        </button>
      ) : null}
    </header>
  )
}

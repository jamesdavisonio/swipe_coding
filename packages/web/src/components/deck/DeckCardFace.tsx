// One card of the deck as it looks: tinted by its kind, the type as a word, how long ago it
// asked, the session and project, the headline, and what the card is about. The top card also
// carries the two stamps a drag reveals and the Details control; the card behind it and the one
// flying off are copies that assistive tech never sees.
import { useId, type ComponentProps, type CSSProperties } from 'react'
import { KIND_LABEL, stampText, type DeckCard } from '../../lib/deck.ts'
import { cn } from '../../lib/cn.ts'
import { Check, ChevronUp } from '../../lib/icons.ts'
import { relativeTime } from '../../lib/threads.ts'
import { laterNote, yesNote } from './stamps.ts'
import { toneClass } from './tones.ts'

export type Face = 'top' | 'back' | 'ghost'

// The colour wash over a dragged card, at full progress.
const WASH_MAX = 0.16

function Stamps({ card, progress, top }: { card: DeckCard; progress: number; top: boolean }) {
  const words = stampText(card)
  const label =
    'pointer-events-none absolute top-5 z-20 max-w-[62%] rounded-md border-3 border-current bg-card px-3 pt-1.5 pb-2'
  return (
    <>
      <div
        aria-hidden="true"
        data-testid={top ? 'deck-stamp-yes' : undefined}
        className={cn(
          label,
          'left-4 origin-top-left -rotate-10',
          card.important ? 'text-stamp-important' : 'text-ok'
        )}
        style={{ opacity: Math.max(0, progress) }}
      >
        <b className="block text-deck-stamp leading-none font-extrabold uppercase">{words.yes}</b>{' '}
        <small className="mt-1 block text-xs font-semibold">{yesNote(card)}</small>
      </div>
      <div
        aria-hidden="true"
        data-testid={top ? 'deck-stamp-later' : undefined}
        className={cn(label, 'right-4 origin-top-right rotate-10 text-right text-muted-foreground')}
        style={{ opacity: Math.max(0, -progress) }}
      >
        <b className="block text-deck-stamp leading-none font-extrabold uppercase">{words.later}</b>{' '}
        <small className="mt-1 block text-xs font-semibold">{laterNote(card)}</small>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-10',
          progress > 0 ? 'bg-ok' : 'bg-muted-foreground'
        )}
        style={{ opacity: Math.abs(progress) * WASH_MAX }}
      />
    </>
  )
}

// What the card is about under its headline: the choices or the steps. The example stays in the
// details sheet (first thing there), so the card itself says only what yes does.
function CardBody({ card }: { card: DeckCard }) {
  return (
    <>
      {card.choices.length > 0 ? (
        <ul className="grid gap-2">
          {card.choices.map((choice) => (
            <li key={choice.key ?? choice.label} className="rounded-lg bg-current/8 px-3 py-2.5">
              <b className="font-bold">{choice.label}</b>
              {choice.recommended ? (
                <span className="ml-1.5 text-xs font-bold tracking-wide uppercase">
                  recommended
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {card.steps.length > 0 ? (
        <ul className="grid gap-1.5">
          {card.steps.map((step, i) => (
            <li
              key={`${i}:${step.label}`}
              className="flex items-start gap-2.5 rounded-lg bg-current/8 px-3 py-2.5"
            >
              <Check
                aria-hidden="true"
                className={cn('mt-0.5 size-4 shrink-0', step.done ? '' : 'invisible')}
              />
              <span className={step.done ? 'line-through' : undefined}>
                {step.label}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

function Tags({ card }: { card: DeckCard }) {
  const tags = [
    card.revised ? 'Revised after your note' : null,
    card.passed ? 'Passed earlier' : null,
  ]
  const shown = tags.filter((t): t is string => t !== null)
  if (shown.length === 0) return null
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {shown.map((tag) => (
        <span
          key={tag}
          className="rounded-full border-2 border-current px-2 py-0.5 text-xs font-semibold"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

// Type (as a word), how long ago it asked, the session and the project. Spaces between the spans
// keep the words apart in the card's text (screen readers, search).
function CardMeta({ card, now, top }: { card: DeckCard; now: number; top: boolean }) {
  return (
    <>
      <header className="flex items-baseline justify-between gap-2.5 text-xs font-semibold tracking-widest uppercase">
        <span>
          <span data-testid={top ? 'deck-type' : undefined}>{KIND_LABEL[card.kind]}</span>
          {card.important ? ' · important' : null}
        </span>{' '}
        <span className="tracking-normal normal-case">{relativeTime(card.at, now)}</span>
      </header>{' '}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-semibold">
        <span>{card.session}</span>{' '}
        <span className="font-mono text-sm font-normal">{card.projectName}</span>
      </div>
    </>
  )
}

// The way to the details: a button on the top card, a picture of one on the copies.
function DetailsHint({ onDetails }: { onDetails?: () => void }) {
  const look = 'mx-auto flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold'
  if (!onDetails)
    return (
      <span aria-hidden="true" className={look}>
        <ChevronUp className="size-4" />
        Details
      </span>
    )
  return (
    <button type="button" onClick={onDetails} className={cn(look, 'focus-visible:outline-current')}>
      <ChevronUp aria-hidden="true" className="size-4" />
      Details
    </button>
  )
}

export interface DeckCardFaceProps extends ComponentProps<'article'> {
  card: DeckCard
  now: number
  face: Face
  progress?: number
  onDetails?: () => void
  style?: CSSProperties
}

export default function DeckCardFace({
  card,
  now,
  face,
  progress = 0,
  onDetails,
  className,
  ...props
}: DeckCardFaceProps) {
  const headingId = useId()
  const top = face === 'top'
  return (
    <article
      data-testid={top ? 'deck-card' : undefined}
      aria-labelledby={top ? headingId : undefined}
      aria-hidden={top ? undefined : true}
      inert={!top}
      className={cn(
        'absolute inset-0 flex flex-col overflow-hidden rounded-deck-card px-5 pt-5 pb-3 shadow-xl select-none',
        toneClass(card),
        className
      )}
      {...props}
    >
      <CardMeta card={card} now={now} top={top} /> <Tags card={card} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3.5 overflow-hidden py-3">
        <h2
          id={headingId}
          className="text-deck-headline leading-tight font-extrabold tracking-tight"
        >
          {card.headline}
        </h2>
        <CardBody card={card} />
      </div>
      <DetailsHint onDetails={top ? onDetails : undefined} />{' '}
      {/* Last in the text, first on screen (absolute, above the content). */}
      {face !== 'back' ? <Stamps card={card} progress={progress} top={top} /> : null}
    </article>
  )
}

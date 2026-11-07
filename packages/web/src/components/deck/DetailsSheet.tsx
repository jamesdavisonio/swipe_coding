// Swipe up: the card in full. The example first, then the brief's parts (or, for a card without a
// brief, what it is about; for a suggested-next card, who suggested it, why, what that session
// finished and what agreeing does), then the way out to the session: "Open in Claude" when the
// bound session has a Claude link, and the thread on the board.
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { BRIEF_SECTIONS, parseBrief, withoutSuggestedNext, type Brief } from '../../lib/brief.ts'
import { cn } from '../../lib/cn.ts'
import { KIND_LABEL, type DeckCard } from '../../lib/deck.ts'
import { ExternalLink, MessageSquare } from '../../lib/icons.ts'
import { relativeTime, webUrl } from '../../lib/threads.ts'
import { Button } from '../ui/button.tsx'
import DeckSheet from './DeckSheet.tsx'
import { toneClass } from './tones.ts'

type Fact = [heading: string, text: string]

// A brief's non-empty parts, under their headings.
const briefFacts = ({ parts }: Brief): Fact[] =>
  BRIEF_SECTIONS.map(({ key, heading }): Fact => [heading, parts[key]]).filter(([, t]) => t !== '')

// What the card says beyond its headline, as heading and text pairs.
function factsOf(card: DeckCard, task: Task | null): Fact[] {
  if (card.brief) return briefFacts(card.brief)
  const facts: Fact[] = []
  const question = task?.needs?.question?.trim()
  if (card.kind === 'question' && question && question !== card.headline)
    facts.push(['The question', question])
  if (card.kind === 'summary' && task?.summary)
    facts.push(['What was done', withoutSuggestedNext(task.summary)])
  return facts
}

function Facts({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null
  return (
    <dl className="mt-4 grid gap-3.5">
      {facts.map(([heading, text]) => (
        <div key={heading}>
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {heading}
          </dt>
          <dd className="mt-0.5 leading-normal whitespace-pre-line">{text}</dd>
        </div>
      ))}
    </dl>
  )
}

// A part of the sheet named by its heading (a region for screen readers).
function Region({ heading, children }: { heading: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="mt-4">
      <h3
        id={headingId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {heading}
      </h3>
      {children}
    </section>
  )
}

function Lines({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <Region heading={heading}>
      <ul className="mt-1 grid list-disc gap-1 pl-5">
        {lines.map((line, i) => (
          <li key={`${i}:${line}`}>{line}</li>
        ))}
      </ul>
    </Region>
  )
}

// What the suggesting session finished: its summary brief's parts, else its text without the
// Suggested next part (never the raw suggestion lines or heading markup).
function Finished({ summary }: { summary: string }) {
  const brief = parseBrief(summary)
  if (brief) return <Facts facts={briefFacts(brief)} />
  return (
    <p className="mt-0.5 leading-normal whitespace-pre-line">{withoutSuggestedNext(summary)}</p>
  )
}

// A suggested-next card in full: who suggested it, why, what that session finished (with its pull
// request) and what agreeing does.
function Suggestion({ card, task, now }: { card: DeckCard; task: Task | null; now: number }) {
  const summary = typeof task?.summary === 'string' ? task.summary : ''
  const pr = webUrl(task?.pr?.url)
  return (
    <>
      <Region heading="Suggested by">
        <p className="mt-0.5 font-semibold">{card.session}</p>
        <p className="text-sm text-muted-foreground">
          {`${card.projectName} · done ${relativeTime(card.at, now)}`}
        </p>
      </Region>
      {card.why ? (
        <Region heading="Why">
          <p className="mt-0.5 leading-normal">{card.why}</p>
        </Region>
      ) : null}
      <Region heading="What that session finished">
        <Finished summary={summary} />
        {pr && task?.pr ? (
          <a
            href={pr}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-2"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            {`Pull request #${task.pr.number}`}
          </a>
        ) : null}
      </Region>
      <Region heading="If you agree">
        <p className="mt-0.5 leading-normal">
          {`Queues a task in ${card.projectName}. The next session there writes a spec, and nothing is built until you confirm it.`}
        </p>
      </Region>
    </>
  )
}

export default function DetailsSheet({
  card,
  task,
  remoteUrl,
  now,
  onClose,
}: {
  card: DeckCard
  task: Task | null
  remoteUrl: string | null
  now: number
  onClose: () => void
}) {
  const claude = webUrl(remoteUrl)
  const pr = webUrl(task?.pr?.url)
  const steps = card.steps.map((s) => (s.done ? `${s.label} (done)` : s.label))
  return (
    <DeckSheet
      eyebrow={`${KIND_LABEL[card.kind]} · ${card.session} · ${card.projectName}`}
      title={card.headline}
      onClose={onClose}
    >
      {card.example ? (
        <div className={cn('rounded-xl p-4', toneClass(card))}>
          <p className="mb-1.5 text-xs font-semibold tracking-widest uppercase">Example</p>
          <p className="text-lg leading-snug">{card.example}</p>
        </div>
      ) : null}
      {card.kind === 'next' ? (
        <Suggestion card={card} task={task} now={now} />
      ) : (
        <Facts facts={factsOf(card, task)} />
      )}
      <Lines heading="Choices" lines={card.choices.map((c) => c.label)} />
      <Lines heading={card.kind === 'todos' ? 'Only you can do' : 'Steps'} lines={steps} />
      <div className="mt-5 grid gap-2">
        {claude ? (
          <Button asChild variant="primary" block>
            <a href={claude} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Open in Claude
            </a>
          </Button>
        ) : null}
        {pr && task?.pr && card.kind !== 'next' ? (
          <Button asChild variant="outline" block>
            <a href={pr} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              {`PR #${task.pr.number} on GitHub`}
            </a>
          </Button>
        ) : null}
        {card.taskId ? (
          <Button asChild variant="outline" block>
            <Link to={`/t/${card.taskId}`}>
              <MessageSquare aria-hidden="true" />
              Open the thread
            </Link>
          </Button>
        ) : null}
      </div>
    </DeckSheet>
  )
}

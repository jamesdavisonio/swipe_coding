// Swipe up: the card in full. The example first, then the brief's parts (or, for a card without a
// brief, what it is about), then the way out to the session: "Open in Claude" when the bound
// session has a Claude link, and the thread on the board.
import { Link } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { BRIEF_SECTIONS, withoutSuggestedNext } from '../../lib/brief.ts'
import { cn } from '../../lib/cn.ts'
import { KIND_LABEL, type DeckCard } from '../../lib/deck.ts'
import { ExternalLink, MessageSquare } from '../../lib/icons.ts'
import { webUrl } from '../../lib/threads.ts'
import { Button } from '../ui/button.tsx'
import DeckSheet from './DeckSheet.tsx'
import { toneClass } from './tones.ts'

type Fact = [heading: string, text: string]

// What the card says beyond its headline, as heading and text pairs.
function factsOf(card: DeckCard, task: Task | null): Fact[] {
  if (card.brief) {
    const parts = card.brief.parts
    return BRIEF_SECTIONS.map(({ key, heading }): Fact => [heading, parts[key]]).filter(
      ([, t]) => t !== ''
    )
  }
  const facts: Fact[] = []
  const question = task?.needs?.question?.trim()
  if (card.kind === 'question' && question && question !== card.headline)
    facts.push(['The question', question])
  if (card.kind === 'summary' && task?.summary)
    facts.push(['What was done', withoutSuggestedNext(task.summary)])
  if (card.suggestion) facts.push(['Suggested by', card.session])
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

function Lines({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </h3>
      <ul className="mt-1 grid list-disc gap-1 pl-5">
        {lines.map((line, i) => (
          <li key={`${i}:${line}`}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

export default function DetailsSheet({
  card,
  task,
  remoteUrl,
  onClose,
}: {
  card: DeckCard
  task: Task | null
  remoteUrl: string | null
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
      <Facts facts={factsOf(card, task)} />
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
        {pr && task?.pr ? (
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

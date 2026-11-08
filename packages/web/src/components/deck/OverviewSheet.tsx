// Swipe down: what is waiting, from the top. The count, a chip per kind, a row per project
// (tapping one puts all its cards first), who is working now and the notifications bell.
import { cn } from '../../lib/cn.ts'
import { deckOverview, KIND_LABEL, type DeckCard } from '../../lib/deck.ts'
import DeckSheet from './DeckSheet.tsx'
import NotifySwitch from './NotifySwitch.tsx'
import { kindToneClass } from './tones.ts'
import type { WorkingSession } from './working.ts'

const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`

export default function OverviewSheet({
  deck,
  working,
  onProject,
  onClose,
}: {
  deck: readonly DeckCard[]
  working: readonly WorkingSession[]
  onProject: (projectId: string) => void
  onClose: () => void
}) {
  const overview = deckOverview(deck)
  const passed = deck.filter((c) => c.passed).length
  return (
    <DeckSheet side="top" eyebrow="Waiting for you" title={cards(overview.total)} onClose={onClose}>
      {passed > 0 ? (
        <p className="text-muted-foreground">{`${passed} of them you passed once.`}</p>
      ) : null}
      <ul aria-label="By type" className="mt-3 mb-4 flex flex-wrap gap-1.5">
        {overview.byKind.map(({ kind, count }) => (
          <li
            key={kind}
            className={cn('rounded-full px-2.5 py-1 text-sm font-semibold', kindToneClass(kind))}
          >
            {`${count} ${KIND_LABEL[kind].toLowerCase()}`}
          </li>
        ))}
      </ul>
      <ul aria-label="By project" className="grid gap-2">
        {overview.byProject.map((p) => (
          <li key={p.projectId}>
            <button
              type="button"
              onClick={() => onProject(p.projectId)}
              className="grid min-h-14 w-full grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 rounded-xl border border-border px-3.5 py-3 text-left"
            >
              <span className="font-mono font-medium">{p.projectName}</span>
              <span className="row-span-2 self-center text-xl font-bold tabular-nums">
                {p.count}
              </span>
              <span className="text-sm text-muted-foreground">
                {p.kinds.map((k) => KIND_LABEL[k]).join(', ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        Tap a project to put all its cards first.
      </p>
      {working.length > 0 ? (
        <p className="mt-3 text-sm leading-normal text-muted-foreground">
          {`Working now: ${working.map((w) => `${w.title} (${w.projectName})`).join(', ')}.`}
        </p>
      ) : null}
      <NotifySwitch />
    </DeckSheet>
  )
}

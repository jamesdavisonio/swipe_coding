// After a voice note: the card has left, and this line says the deck is waiting for that
// session's revised card. The live region stays mounted so the line is announced when it appears.
import type { Waiting } from './use-waiting.ts'

export default function WaitingLine({ waiting }: { waiting: readonly Waiting[] }) {
  return (
    <div aria-live="polite">
      {waiting.length > 0 ? (
        <ul className="mb-2.5 grid gap-1.5">
          {waiting.map((w) => (
            <li
              key={w.taskId}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm"
            >
              <span
                aria-hidden="true"
                data-slot="waiting-dot"
                className="size-2 shrink-0 rounded-full bg-muted-foreground"
              />
              {`Waiting for ${w.session}'s revised card…`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

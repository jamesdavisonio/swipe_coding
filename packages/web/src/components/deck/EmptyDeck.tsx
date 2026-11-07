// No cards: nothing needs James, and the sessions working now.
import type { WorkingSession } from './working.ts'

export default function EmptyDeck({ working }: { working: readonly WorkingSession[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3.5 px-1 py-2">
      <h1 className="text-3xl leading-tight font-extrabold tracking-tight">Nothing needs you.</h1>
      {working.length > 0 ? (
        <>
          <p className="text-muted-foreground">
            {working.length === 1 ? '1 session working:' : `${working.length} sessions working:`}
          </p>
          <ul className="grid gap-1.5">
            {working.map((w) => (
              <li key={w.taskId}>
                <span className="mr-2 font-mono text-sm text-muted-foreground">
                  {w.projectName}
                </span>
                {w.title}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground">No session is working right now.</p>
      )}
    </div>
  )
}

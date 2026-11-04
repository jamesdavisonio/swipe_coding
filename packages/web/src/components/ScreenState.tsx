import { Loader2 } from '../lib/icons.ts'
import { Button } from './ui/button.tsx'

// The unobtrusive loading state every list screen shares: a spinner in a status region named
// after what is loading ("Loading projects").
export function LoadingStatus({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex justify-center p-10 text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-6 animate-spin" />
    </div>
  )
}

// A rejected read: what could not be loaded and a Retry that re-subscribes each failed source.
export function LoadFailed({
  title,
  failed,
}: {
  title: string
  failed: readonly { retry: () => void }[]
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="font-bold">{title}</p>
      <p className="text-sm text-muted-foreground">Check the connection, then try again.</p>
      <Button variant="outline" onClick={() => failed.forEach((source) => source.retry())}>
        Retry
      </Button>
    </div>
  )
}

// A quiet line for an empty list.
export function EmptyNote({ children }: { children: string }) {
  return <p className="py-10 text-center text-muted-foreground">{children}</p>
}

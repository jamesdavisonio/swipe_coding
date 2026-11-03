import { Link } from 'react-router-dom'
import { Button } from './ui/button.tsx'
import { Loader2 } from '../lib/icons.ts'

const PAGE =
  'mx-auto flex min-h-dvh w-full max-w-(--content-max) flex-col items-center justify-center p-10'

// Shown while the task or its comments load.
export function ThreadLoading() {
  return (
    <div className={PAGE}>
      <div role="status" aria-label="Loading thread" className="text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-6 animate-spin" />
      </div>
    </div>
  )
}

// A rejected read of the task or its comments; Retry re-subscribes each failed source.
export function ThreadFailed({ failed }: { failed: { retry: () => void }[] }) {
  return (
    <div className={PAGE}>
      <div role="alert" className="flex flex-col items-center gap-3 text-center">
        <p className="font-bold">Couldn't load this thread</p>
        <p className="text-sm text-muted-foreground">Check the connection, then try again.</p>
        <Button variant="outline" onClick={() => failed.forEach((source) => source.retry())}>
          Retry
        </Button>
      </div>
    </div>
  )
}

// An id with no task behind it (deleted, or a mistyped link).
export function ThreadGone() {
  return (
    <div className={PAGE}>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-bold">This task no longer exists.</p>
        <Button asChild variant="outline">
          <Link to="/">Back to threads</Link>
        </Button>
      </div>
    </div>
  )
}

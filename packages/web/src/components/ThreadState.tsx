import { Link } from 'react-router-dom'
import { LoadFailed, LoadingStatus } from './ScreenState.tsx'
import { Button } from './ui/button.tsx'

const PAGE =
  'mx-auto flex min-h-dvh w-full max-w-(--content-max) flex-col items-center justify-center p-10'

// Shown while the task or its comments load.
export function ThreadLoading() {
  return (
    <div className={PAGE}>
      <LoadingStatus label="Loading thread" />
    </div>
  )
}

// A rejected read of the task or its comments; Retry re-subscribes each failed source.
export function ThreadFailed({ failed }: { failed: { retry: () => void }[] }) {
  return (
    <div className={PAGE}>
      <LoadFailed title="Couldn't load this thread" failed={failed} />
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

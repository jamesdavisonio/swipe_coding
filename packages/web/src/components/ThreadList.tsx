import type { ReactNode } from 'react'
import { Button } from './ui/button.tsx'
import { Loader2 } from '../lib/icons.ts'
import type { ThreadRow } from '../lib/threads.ts'

function Section({
  title,
  rows,
  render,
}: {
  title: string
  rows: ThreadRow[]
  render: (row: ThreadRow) => ReactNode
}) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="px-4 pt-2.5 pb-1.5 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      <ul>{rows.map(render)}</ul>
    </section>
  )
}

// The body of Threads: a loading status, the read-error state with Retry, the empty copy, or
// the "Needs you" and "Quiet" sections (each only when it has rows).
export default function ThreadList({
  loading,
  failed,
  rows,
  render,
}: {
  loading: boolean
  failed: { retry: () => void }[]
  rows: ThreadRow[]
  render: (row: ThreadRow) => ReactNode
}) {
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading threads"
        className="flex justify-center p-10 text-muted-foreground"
      >
        <Loader2 aria-hidden="true" className="size-6 animate-spin" />
      </div>
    )
  if (failed.length > 0)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="font-bold">Couldn't load threads</p>
        <p className="text-sm text-muted-foreground">Check the connection, then try again.</p>
        <Button variant="outline" onClick={() => failed.forEach((source) => source.retry())}>
          Retry
        </Button>
      </div>
    )
  if (rows.length === 0)
    return <p className="p-10 text-center text-muted-foreground">No threads for this project.</p>
  return (
    <>
      <Section title="Needs you" rows={rows.filter((r) => r.needs)} render={render} />
      <Section title="Quiet" rows={rows.filter((r) => !r.needs)} render={render} />
    </>
  )
}

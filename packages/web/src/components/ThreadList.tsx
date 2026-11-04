import type { ReactNode } from 'react'
import { EmptyNote, LoadFailed, LoadingStatus } from './ScreenState.tsx'
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
  if (loading) return <LoadingStatus label="Loading threads" />
  if (failed.length > 0) return <LoadFailed title="Couldn't load threads" failed={failed} />
  if (rows.length === 0) return <EmptyNote>No threads for this project.</EmptyNote>
  return (
    <>
      <Section title="Needs you" rows={rows.filter((r) => r.needs)} render={render} />
      <Section title="Quiet" rows={rows.filter((r) => !r.needs)} render={render} />
    </>
  )
}

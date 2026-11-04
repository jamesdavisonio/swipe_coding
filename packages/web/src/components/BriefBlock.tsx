import type { Brief } from '../lib/brief.ts'
import BriefCard from './BriefCard.tsx'

// A brief in its context: the text the session wrote above it, the card, then the text below
// it (`after` stands in for the brief's own when a screen has taken something out of it).
export default function BriefBlock({
  brief,
  after = brief.after,
}: {
  brief: Brief
  after?: string
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {brief.before ? <p>{brief.before}</p> : null}
      <BriefCard brief={brief} />
      {after ? <p>{after}</p> : null}
    </div>
  )
}

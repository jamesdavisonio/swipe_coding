import { BRIEF_SECTIONS, type Brief } from '../lib/brief.ts'

// A decision brief as the card sessions meant it: the gate's label as a heading, then the six
// parts, each under its sub-heading, in the format's order.
export default function BriefCard({ brief }: { brief: Brief }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3.5">
      <h3 className="text-base font-extrabold tracking-tight">{brief.label}</h3>
      {BRIEF_SECTIONS.map(({ key, heading }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <h4 className="text-xs font-bold text-muted-foreground">{heading}</h4>
          <p className="text-base leading-snug">{brief.parts[key]}</p>
        </div>
      ))}
    </section>
  )
}

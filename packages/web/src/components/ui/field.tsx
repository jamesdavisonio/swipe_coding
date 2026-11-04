import type { ReactNode } from 'react'
import { Label } from './label.tsx'

// A caption above a control. With `htmlFor` it is a <label> for that control. Without it the
// control is a group that names itself (a Segmented), so the caption is plain text, hidden from
// assistive tech because the group already announces the same name.
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <Label htmlFor={htmlFor}>{label}</Label>
      ) : (
        <span aria-hidden="true" className="text-sm font-semibold text-foreground select-none">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

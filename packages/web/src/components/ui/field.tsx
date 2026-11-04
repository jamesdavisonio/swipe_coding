import type { ReactNode } from 'react'
import { Label } from './label.tsx'

// A label above a control. Pass `htmlFor` for a single control; leave it out when the control is
// a group that names itself (a Segmented).
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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

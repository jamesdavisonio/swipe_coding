import type { ReactNode } from 'react'
import BottomNav from './BottomNav.tsx'

// The frame the list screens share: the centred phone column, the sticky header, the content
// above the bottom navigation.
export default function Screen({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-(--content-max) flex-col">
      {header}
      <main className="flex-1 pb-28">{children}</main>
      <BottomNav />
    </div>
  )
}

import { useState } from 'react'
import type { Task } from '@kanban/shared'
import { EmptyNote } from './ScreenState.tsx'
import { DoneTaskCard } from './TaskCards.tsx'
import { Button } from './ui/button.tsx'

// The Done tab: what finished within the window, then, when there is more, a button that
// reveals (and hides again) the older ones below. Both lists arrive newest finish first.
export default function DoneList({
  recent,
  older,
  now,
}: {
  recent: Task[]
  older: Task[]
  now: number
}) {
  const [showOlder, setShowOlder] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      {recent.length === 0 ? <EmptyNote>Nothing finished this week.</EmptyNote> : null}
      <ul className="flex flex-col gap-3">
        {recent.map((task) => (
          <DoneTaskCard key={task.id} task={task} now={now} />
        ))}
      </ul>
      {older.length > 0 ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => setShowOlder((shown) => !shown)}
        >
          {`${showOlder ? 'Hide' : 'Show'} ${older.length} older`}
        </Button>
      ) : null}
      {showOlder ? (
        <ul className="flex flex-col gap-3">
          {older.map((task) => (
            <DoneTaskCard key={task.id} task={task} now={now} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

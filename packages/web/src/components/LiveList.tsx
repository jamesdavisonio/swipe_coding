import type { Task } from '@kanban/shared'
import { EmptyNote } from './ScreenState.tsx'
import { LiveTaskCard } from './TaskCards.tsx'

// The Live tab: tasks in flight, James's turn first (the order arrives sorted).
export default function LiveList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return <EmptyNote>Nothing live. Queue a task from New task.</EmptyNote>
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => (
        <LiveTaskCard key={task.id} task={task} />
      ))}
    </ul>
  )
}

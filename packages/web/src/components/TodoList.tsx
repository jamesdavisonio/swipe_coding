import { useState, type FormEvent } from 'react'
import type { Todo } from '@kanban/shared'
import { cn } from '../lib/cn.ts'
import { MAX_TODO_CHARS } from '../lib/limits.ts'
import { ExternalLink } from '../lib/icons.ts'
import { webUrl } from '../lib/threads.ts'
import { useTodoActions } from '../lib/use-todo-actions.ts'
import { EmptyNote } from './ScreenState.tsx'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Input } from './ui/input.tsx'

// One item: a whole 44 px row that ticks it, struck through once done, with an Open link out
// while it is open and has a web link. The link sits beside the label, so it is not part of the
// checkbox's name.
function TodoRow({ todo, onToggle }: { todo: Todo; onToggle: (todo: Todo) => void }) {
  const href = todo.done ? null : webUrl(todo.link)
  return (
    <li className="flex items-center gap-2 border-b border-border last:border-b-0">
      <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 py-2">
        <input
          type="checkbox"
          className="size-7 shrink-0 accent-ok focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          checked={todo.done}
          onChange={() => onToggle(todo)}
        />
        <span className={cn('flex-1', todo.done && 'text-muted-foreground line-through')}>
          {todo.body}
        </span>
      </label>
      {href ? (
        <Button asChild variant="outline">
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${todo.body}`}>
            Open
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      ) : null}
    </li>
  )
}

// The text field and Add button under the list. The text clears at once (so a second tap has
// nothing to add) and comes back if the write is refused.
function AddTodo({ onAdd }: { onAdd: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const body = text.trim()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (body === '') return
    setText('')
    void onAdd(body).then((saved) => {
      if (!saved) setText((current) => (current === '' ? body : current))
    })
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        aria-label="Add something to do by hand"
        placeholder="Something to do by hand…"
        maxLength={MAX_TODO_CHARS}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" disabled={body === ''}>
        Add
      </Button>
    </form>
  )
}

// The For James tab: the project's hand-done items (open first, newest first) and the add form.
export default function TodoList({ projectId, todos }: { projectId: string; todos: Todo[] }) {
  const actions = useTodoActions(projectId)
  return (
    <div className="flex flex-col gap-3">
      {todos.length === 0 ? (
        <EmptyNote>Nothing for you to do by hand.</EmptyNote>
      ) : (
        <ul className="rounded-lg border border-border bg-card px-4 shadow-sm">
          {todos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onToggle={actions.toggle} />
          ))}
        </ul>
      )}
      <SaveError failed={actions.failed} />
      <AddTodo onAdd={actions.add} />
    </div>
  )
}

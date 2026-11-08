// The deck's to-do drawer: every to-do from the board, whether the drawer is open, and the tick.
// A tick shows at once: the to-do wears its new state here until the board's snapshot agrees,
// and a write that fails takes it back (track logs the failure under the tap's request id).
import { useMemo, useState } from 'react'
import type { Project, Task, Todo } from '@kanban/shared'
import { toggleTodo, useAllTodos } from '../../data.ts'
import { todoSections, todoSummary } from '../../lib/todo-drawer.ts'
import { track } from '../../lib/use-thread-actions.ts'

type Shown = ReadonlyMap<string, boolean>

// The ticks the snapshot has not caught up with yet: done as shown, per to-do id.
function stillAhead(shown: Shown, todos: readonly Todo[]): Shown {
  const done = new Map(todos.map((t) => [t.id, t.done]))
  return new Map([...shown].filter(([id, d]) => done.get(id) === !d))
}

const withShown = (todo: Todo, done: boolean | undefined): Todo =>
  done === undefined || done === todo.done
    ? todo
    : { ...todo, done, doneAt: done ? Date.now() : null }

function useOptimisticTodos(todos: readonly Todo[]) {
  const [shown, setShown] = useState<Shown>(new Map())
  // A new snapshot drops the ticks it already holds (adjusting state while rendering, not in an
  // effect, so no frame shows the old row).
  const [seen, setSeen] = useState(todos)
  if (seen !== todos) {
    setSeen(todos)
    setShown(stillAhead(shown, todos))
  }

  const merged = useMemo(() => todos.map((t) => withShown(t, shown.get(t.id))), [todos, shown])

  const set = (id: string, done: boolean) => setShown((m) => new Map(m).set(id, done))
  // Forgets a tick, unless a later tap has changed it again.
  const drop = (id: string, done: boolean) =>
    setShown((m) => {
      if (m.get(id) !== done) return m
      const next = new Map(m)
      next.delete(id)
      return next
    })
  return { todos: merged, set, drop }
}

export function useTodoDrawer(tasks: readonly Task[], projects: readonly Project[]) {
  const all = useAllTodos()
  const optimistic = useOptimisticTodos(all.data)
  const [open, setOpen] = useState(false)
  const sections = useMemo(
    () => todoSections({ todos: optimistic.todos, projects, tasks }),
    [optimistic.todos, projects, tasks]
  )

  // Ticks or unticks the to-do as shown; the write is the to-do's own state, so a repeated tap
  // toggles predictably.
  function toggle(todo: Todo) {
    const done = !todo.done
    optimistic.set(todo.id, done)
    void track('toggle_todo', todo.id, () => toggleTodo(todo)).then((ok) => {
      if (!ok) optimistic.drop(todo.id, done)
    })
  }

  return {
    sections,
    summary: todoSummary(sections),
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    toggle,
  }
}

export type TodoDrawerModel = ReturnType<typeof useTodoDrawer>

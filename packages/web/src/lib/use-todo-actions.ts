// What a tap on a project's For James tab does: log it (one request id per tap), run the write
// and remember whether the last one was refused. A refused tick needs no revert here: the list
// shows what the snapshot says, which never took the change.
import { useState } from 'react'
import type { Todo } from '@kanban/shared'
import { addTodo, toggleTodo } from '../data.ts'
import { track } from './use-thread-actions.ts'

export function useTodoActions(projectId: string) {
  const [failed, setFailed] = useState(false)

  function run(action: string, target: string, write: () => Promise<unknown>): Promise<boolean> {
    setFailed(false)
    return track(action, target, write).then((ok) => {
      if (!ok) setFailed(true)
      return ok
    })
  }

  return {
    failed,
    // Ticks an open todo (todo_done) or unticks a done one (todo_undone).
    toggle: (todo: Todo) =>
      void run(todo.done ? 'todo_undone' : 'todo_done', todo.id, () => toggleTodo(todo)),
    // Adds an item; the result says whether it was saved.
    add: (text: string) => run('todo_add', projectId, () => addTodo(projectId, text)),
  }
}

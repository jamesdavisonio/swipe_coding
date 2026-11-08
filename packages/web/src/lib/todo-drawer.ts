// The deck's to-do drawer: every to-do grouped by project. Pure data in, ordered sections out: no
// React, no Firestore. Projects with open to-dos come first (the one waiting longest first), the
// rest by name; inside a project the open ones oldest first, then the done ones newest first.
import type { Project, Task, Todo } from '@kanban/shared'

// A to-do with the title of the task it came from (null for one added by hand or whose task is gone).
export interface TodoRow {
  todo: Todo
  taskTitle: string | null
}
export interface TodoSection {
  projectId: string
  projectName: string
  open: TodoRow[]
  done: TodoRow[]
}
export interface TodoSectionsInput {
  todos: readonly Todo[]
  projects: readonly Project[]
  tasks: readonly Task[]
}

const oldestFirst = (a: TodoRow, b: TodoRow) => a.todo.createdAt - b.todo.createdAt
const newestDoneFirst = (a: TodoRow, b: TodoRow) => (b.todo.doneAt ?? 0) - (a.todo.doneAt ?? 0)

// Sections with open to-dos first, the oldest open to-do first; the rest by name.
function sectionOrder(a: TodoSection, b: TodoSection): number {
  const [x, y] = [a.open[0]?.todo.createdAt, b.open[0]?.todo.createdAt]
  if (x !== undefined && y !== undefined && x !== y) return x - y
  if (x !== undefined && y === undefined) return -1
  if (x === undefined && y !== undefined) return 1
  return a.projectName.localeCompare(b.projectName)
}

export function todoSections(input: TodoSectionsInput): TodoSection[] {
  const names = new Map(input.projects.map((p) => [p.id, p.name]))
  const titles = new Map(input.tasks.map((t) => [t.id, t.title]))
  const byProject = new Map<string, TodoRow[]>()
  for (const todo of input.todos) {
    const row = {
      todo,
      taskTitle: todo.sourceTaskId ? (titles.get(todo.sourceTaskId) ?? null) : null,
    }
    byProject.set(todo.projectId, [...(byProject.get(todo.projectId) ?? []), row])
  }
  return [...byProject]
    .map(([projectId, rows]) => ({
      projectId,
      projectName: names.get(projectId) ?? projectId,
      open: rows.filter((r) => !r.todo.done).sort(oldestFirst),
      done: rows.filter((r) => r.todo.done).sort(newestDoneFirst),
    }))
    .sort(sectionOrder)
}

export interface TodoSummary {
  open: number
  projects: number
}

// How many to-dos are open, and in how many projects.
export function todoSummary(sections: readonly TodoSection[]): TodoSummary {
  const withOpen = sections.filter((s) => s.open.length > 0)
  return { open: withOpen.reduce((n, s) => n + s.open.length, 0), projects: withOpen.length }
}

// The drawer's line under its title: "7 to do across 3 projects".
export function summaryLine({ open, projects }: TodoSummary): string {
  if (open === 0) return 'Nothing left to do'
  return `${open} to do across ${projects} ${projects === 1 ? 'project' : 'projects'}`
}

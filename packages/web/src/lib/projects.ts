// Pure helpers behind Projects and a project's tabs: what is live, what finished this week, the
// order of each list, and which projects have a session heartbeating. No React, no Firestore.
// Windows come from @kanban/shared (AGENT_STALE_MS, DONE_VISIBLE_MS), never from literals here.
import {
  isAgentOnline,
  isDone,
  isTaskVisible,
  type AgentDoc,
  type Task,
  type Todo,
} from '@kanban/shared'
import { activeNeed, needsCount } from './threads.ts'

// The ids of the projects with an agent that has heartbeated recently.
export function liveProjectIds(agents: readonly AgentDoc[], now: number): Set<string> {
  return new Set(agents.filter((agent) => isAgentOnline(agent, now)).map((a) => a.projectId))
}

// Tasks still in flight: not done, and never the pinned For James task. James's turn first, then
// the most recently updated.
export function liveTasks(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((task) => task.type !== 'for_james' && !isDone(task))
    .sort(
      (a, b) =>
        Number(activeNeed(b) !== null) - Number(activeNeed(a) !== null) || b.updatedAt - a.updatedAt
    )
}

// Finished tasks, newest finish first: the ones still inside the visibility window, and the rest
// (what "Show older" brings back). A done task without a doneAt counts as recent.
export function doneTasks(tasks: readonly Task[], now: number): { recent: Task[]; older: Task[] } {
  const finished = tasks.filter((task) => task.type !== 'for_james' && isDone(task))
  const newestFirst = (a: Task, b: Task) => (b.doneAt ?? b.updatedAt) - (a.doneAt ?? a.updatedAt)
  const visible = (task: Task) => isTaskVisible(task, { now })
  return {
    recent: finished.filter(visible).sort(newestFirst),
    older: finished.filter((task) => !visible(task)).sort(newestFirst),
  }
}

// The For James list: open items before done ones, newest first within each.
export function orderTodos(todos: readonly Todo[]): Todo[] {
  return [...todos].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
}

export const NO_PROJECTS_TEXT = 'No projects yet. Start a Claude session in a folder to add one.'

// "desk-pc · session live" / "desk-pc · no session": where the project runs and whether a
// session is heartbeating there.
export const hostLine = (host: string, live: boolean): string =>
  `${host} · ${live ? 'session live' : 'no session'}`

export interface ProjectCounts {
  needs: number
  live: number
  doneThisWeek: number
  forJames: number
}

// The numbers on a project's card. `tasks` and `todos` are the board's (every project's); the
// needs count is the Threads chip's, so the two screens agree.
export function projectCounts(input: {
  tasks: readonly Task[]
  todos: readonly Todo[]
  projectId: string
  now: number
}): ProjectCounts {
  const { projectId, now } = input
  const tasks = input.tasks.filter((task) => task.projectId === projectId)
  const todos = input.todos.filter((todo) => todo.projectId === projectId)
  return {
    needs: needsCount({ tasks, todos, now }),
    live: liveTasks(tasks).length,
    doneThisWeek: doneTasks(tasks, now).recent.length,
    forJames: todos.filter((todo) => !todo.done).length,
  }
}

export type ProjectTab = 'live' | 'james' | 'done'
export const PROJECT_TAB_PARAM = 'tab'
const DEFAULT_TAB: ProjectTab = 'live'

// The tab the URL names; anything unknown is the default.
export function parseTab(value: string | null): ProjectTab {
  return value === 'james' || value === 'done' || value === 'live' ? value : DEFAULT_TAB
}
export const isDefaultTab = (tab: ProjectTab): boolean => tab === DEFAULT_TAB

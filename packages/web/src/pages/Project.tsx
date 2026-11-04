import { useMemo, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { Project as ProjectDoc, Task, Todo } from '@kanban/shared'
import { useAgents, useProject, useProjectTasks, useProjectTodos } from '../data.ts'
import DoneList from '../components/DoneList.tsx'
import PageHeader from '../components/PageHeader.tsx'
import Screen from '../components/Screen.tsx'
import { EmptyNote, LoadFailed, LoadingStatus } from '../components/ScreenState.tsx'
import { LiveTaskCard } from '../components/TaskCards.tsx'
import TodoList from '../components/TodoList.tsx'
import { Button } from '../components/ui/button.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { Plus } from '../lib/icons.ts'
import {
  PROJECT_TAB_PARAM,
  doneTasks,
  hostLine,
  isDefaultTab,
  liveProjectIds,
  liveTasks,
  orderTodos,
  parseTab,
  type ProjectTab,
} from '../lib/projects.ts'
import { useNow } from '../lib/use-now.ts'

const BACK = { to: '/projects', label: 'Back to projects' }

// A project's three tabs for one loaded project: Live (in flight, James's turn first), For James
// (hand-done items) and Done (this week, older behind a button). The tab lives in the URL.
function ProjectView({
  project,
  tasks,
  todos,
  live,
  now,
}: {
  project: ProjectDoc
  tasks: Task[]
  todos: Todo[]
  live: boolean
  now: number
}) {
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get(PROJECT_TAB_PARAM))
  const inFlight = useMemo(() => liveTasks(tasks), [tasks])
  const done = useMemo(() => doneTasks(tasks, now), [tasks, now])
  const ordered = useMemo(() => orderTodos(todos), [todos])

  function choose(next: ProjectTab) {
    const nextParams = new URLSearchParams(params)
    if (isDefaultTab(next)) nextParams.delete(PROJECT_TAB_PARAM)
    else nextParams.set(PROJECT_TAB_PARAM, next)
    setParams(nextParams, { replace: true })
  }

  const tabs = [
    { id: 'live', label: `Live · ${inFlight.length}` },
    { id: 'james', label: `For James · ${todos.filter((todo) => !todo.done).length}` },
    { id: 'done', label: `Done · ${done.recent.length}` },
  ] as const

  return (
    <Screen
      header={
        <PageHeader
          title={project.name}
          sub={hostLine(project.hostname, live)}
          back={BACK}
          right={
            <Button asChild>
              <Link to={`/new?project=${encodeURIComponent(project.id)}`}>
                <Plus aria-hidden="true" />
                Task
              </Link>
            </Button>
          }
        >
          <Segmented label="Project tabs" options={tabs} value={tab} onChange={choose} />
        </PageHeader>
      }
    >
      <div className="px-4">
        {tab === 'live' ? (
          inFlight.length === 0 ? (
            <EmptyNote>Nothing live. Queue a task from New task.</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-3">
              {inFlight.map((task) => (
                <LiveTaskCard key={task.id} task={task} />
              ))}
            </ul>
          )
        ) : null}
        {tab === 'james' ? <TodoList projectId={project.id} todos={ordered} /> : null}
        {tab === 'done' ? <DoneList recent={done.recent} older={done.older} now={now} /> : null}
      </div>
    </Screen>
  )
}

// A header with only the way back, for the states before there is a project to show.
function BareScreen({ children }: { children: ReactNode }) {
  return <Screen header={<PageHeader title="Project" back={BACK} />}>{children}</Screen>
}

// /p/:projectId — one project. The project, its tasks and its todos gate the screen; a failed
// agents read only costs the live line (data.ts logs it).
export default function Project() {
  const { projectId } = useParams()
  const now = useNow()
  const project = useProject(projectId)
  const tasks = useProjectTasks(projectId)
  const todos = useProjectTodos(projectId)
  const agents = useAgents()

  const failed = [project, tasks, todos].filter((source) => source.error !== null)
  if (failed.length > 0)
    return (
      <BareScreen>
        <LoadFailed title="Couldn't load this project" failed={failed} />
      </BareScreen>
    )
  if ([project, tasks, todos, agents].some((source) => source.loading))
    return (
      <BareScreen>
        <LoadingStatus label="Loading project" />
      </BareScreen>
    )
  if (!project.data)
    return (
      <BareScreen>
        <EmptyNote>This project no longer exists.</EmptyNote>
      </BareScreen>
    )
  return (
    <ProjectView
      key={project.data.id}
      project={project.data}
      tasks={tasks.data}
      todos={todos.data}
      live={liveProjectIds(agents.data, now).has(project.data.id)}
      now={now}
    />
  )
}

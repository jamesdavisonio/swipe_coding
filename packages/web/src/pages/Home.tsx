import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Project, Task } from '@kanban/shared'
import { renameProject, useOpenTodos, useProjects, useRecentTasks } from '../data.ts'
import { legacyStatus } from '../lib/legacy-status.ts'
import { Empty, Page, Section, TaskCard, TopBar } from '../ui.tsx'

export default function Home() {
  const projects = useProjects()
  const recent = useRecentTasks()
  const todos = useOpenTodos()
  const waiting = useMemo(
    () => ({
      loading: recent.loading,
      data: recent.data.filter((t) => legacyStatus(t) === 'waiting_on_james'),
    }),
    [recent.loading, recent.data]
  )

  const nameOf = useMemo(() => new Map(projects.data.map((p) => [p.id, p.name])), [projects.data])

  const counts = useMemo(() => {
    const m = new Map<
      string,
      { in_progress: number; waiting: number; queued: number; done: number }
    >()
    for (const t of recent.data) {
      const c = m.get(t.projectId) ?? { in_progress: 0, waiting: 0, queued: 0, done: 0 }
      const status = legacyStatus(t)
      if (status === 'in_progress') c.in_progress++
      else if (status === 'waiting_on_james') c.waiting++
      else if (status === 'queued') c.queued++
      else c.done++
      m.set(t.projectId, c)
    }
    return m
  }, [recent.data])

  const todoCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of todos.data) m.set(t.projectId, (m.get(t.projectId) ?? 0) + 1)
    return m
  }, [todos.data])

  return (
    <>
      <TopBar title="Kanban" />
      <Page>
        <div className="space-y-6">
          <Section title="Waiting on me" count={waiting.data.length}>
            {waiting.loading ? null : waiting.data.length === 0 ? (
              <Empty>Nothing needs you right now.</Empty>
            ) : (
              waiting.data.map((t: Task) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  projectName={nameOf.get(t.projectId) ?? t.projectId}
                />
              ))
            )}
          </Section>

          <Section title="Projects" count={projects.data.length}>
            {projects.error && <p className="text-sm text-red-500">{projects.error}</p>}
            {!projects.loading && projects.data.length === 0 && (
              <Empty>
                No projects yet. Start a Claude Code session with the kanban channel and it will
                register its folder here.
              </Empty>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projects.data.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  counts={counts.get(p.id)}
                  todos={todoCounts.get(p.id) ?? 0}
                />
              ))}
            </div>
          </Section>
        </div>
      </Page>
    </>
  )
}

function ProjectCard({
  project,
  counts,
  todos,
}: {
  project: Project
  counts?: { in_progress: number; waiting: number; queued: number; done: number }
  todos: number
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const c = counts ?? { in_progress: 0, waiting: 0, queued: 0, done: 0 }

  async function save() {
    setEditing(false)
    if (name.trim() && name.trim() !== project.name) await renameProject(project.id, name.trim())
    else setName(project.name)
  }

  return (
    <div className="card p-3">
      <div className="flex items-start gap-2">
        {editing ? (
          <input
            autoFocus
            className="input py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') {
                setName(project.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <Link to={`/p/${project.id}`} className="min-w-0 flex-1">
            <div className="truncate font-semibold">{project.name}</div>
            <div className="truncate font-mono text-[11px] text-slate-500">
              {project.hostname}:{project.cwd}
            </div>
          </Link>
        )}
        {!editing && (
          <button
            className="btn-ghost -mr-2 px-2 text-slate-400"
            onClick={() => setEditing(true)}
            aria-label="Rename"
          >
            ✎
          </button>
        )}
      </div>
      <Link
        to={`/p/${project.id}`}
        className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"
      >
        <Count
          n={c.waiting}
          label="waiting"
          accent={c.waiting > 0 ? 'text-amber-600 dark:text-amber-400' : ''}
        />
        <Count
          n={c.in_progress}
          label="in progress"
          accent={c.in_progress > 0 ? 'text-sky-600 dark:text-sky-400' : ''}
        />
        <Count n={c.queued} label="queued" />
        <Count n={c.done} label="done" />
        {todos > 0 && (
          <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
            {todos} for me
          </span>
        )}
      </Link>
    </div>
  )
}

function Count({ n, label, accent = '' }: { n: number; label: string; accent?: string }) {
  return (
    <span className={accent}>
      <b className="font-semibold">{n}</b> {label}
    </span>
  )
}

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TASK_TYPE_LABELS, type Task, type TaskType, type Todo } from '@kanban/shared'
import {
  addTodo,
  createTask,
  toggleTodo,
  useProject,
  useProjectTasks,
  useProjectTodos,
} from '../data.ts'
import { Empty, Page, Section, Sheet, TaskCard, TopBar } from '../ui.tsx'

const CREATABLE: TaskType[] = ['feature', 'bugfix', 'chore']

export default function Board() {
  const { projectId } = useParams()
  const project = useProject(projectId)
  const tasks = useProjectTasks(projectId)
  const todos = useProjectTodos(projectId)
  const [open, setOpen] = useState(false)

  const cols = useMemo(() => {
    const waiting: Task[] = [],
      progress: Task[] = [],
      queued: Task[] = [],
      done: Task[] = []
    for (const t of tasks.data) {
      if (t.type === 'for_james') continue
      if (t.status === 'waiting_on_james') waiting.push(t)
      else if (t.status === 'queued') queued.push(t)
      else if (t.status === 'done') done.push(t)
      else progress.push(t)
    }
    return { waiting, progress, queued, done: done.slice(0, 20) }
  }, [tasks.data])

  return (
    <>
      <TopBar
        title={project.data?.name ?? '…'}
        back="/"
        right={
          <button className="btn-primary px-3 py-1.5" onClick={() => setOpen(true)}>
            + Task
          </button>
        }
      />
      <Page>
        {tasks.error && <p className="mb-3 text-sm text-red-500">{tasks.error}</p>}
        {projectId && <ForJames projectId={projectId} todos={todos.data} />}

        <div className="mt-6 grid gap-6 md:grid-cols-4 md:gap-4">
          <Section title="Waiting on me" count={cols.waiting.length}>
            {cols.waiting.length === 0 ? (
              <Empty>—</Empty>
            ) : (
              cols.waiting.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </Section>
          <Section title="In progress" count={cols.progress.length}>
            {cols.progress.length === 0 ? (
              <Empty>—</Empty>
            ) : (
              cols.progress.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </Section>
          <Section title="Queued" count={cols.queued.length}>
            {cols.queued.length === 0 ? (
              <Empty>—</Empty>
            ) : (
              cols.queued.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </Section>
          <Section title="Done" count={cols.done.length}>
            {cols.done.length === 0 ? (
              <Empty>—</Empty>
            ) : (
              cols.done.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </Section>
        </div>
      </Page>

      {projectId && (
        <NewTaskSheet projectId={projectId} open={open} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function ForJames({ projectId, todos }: { projectId: string; todos: Todo[] }) {
  const [showDone, setShowDone] = useState(false)
  const [text, setText] = useState('')
  const sorted = useMemo(() => [...todos].sort((a, b) => a.createdAt - b.createdAt), [todos])
  const open = sorted.filter((t) => !t.done)
  const done = sorted.filter((t) => t.done)

  async function submit() {
    if (!text.trim()) return
    await addTodo(projectId, text)
    setText('')
  }

  return (
    <div className="card border-violet-200 p-3 dark:border-violet-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-violet-800 dark:text-violet-200">For James</h2>
        <span className="text-xs text-slate-500">{open.length} open</span>
      </div>
      {open.length === 0 && <p className="text-sm text-slate-500">Nothing for you here.</p>}
      <ul className="space-y-1">
        {open.map((t) => (
          <TodoRow key={t.id} todo={t} />
        ))}
      </ul>
      {done.length > 0 && (
        <button
          className="mt-2 text-xs text-slate-500 underline"
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? 'Hide' : 'Show'} {done.length} done
        </button>
      )}
      {showDone && (
        <ul className="mt-1 space-y-1 opacity-60">
          {done.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          className="input py-1.5"
          placeholder="Add something to do…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-outline" type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}

function TodoRow({ todo }: { todo: Todo }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-violet-600"
        checked={todo.done}
        onChange={() => toggleTodo(todo)}
      />
      <span className={`min-w-0 flex-1 ${todo.done ? 'line-through' : ''}`}>
        {todo.body}
        {todo.link && (
          <>
            {' '}
            ·{' '}
            <a
              className="text-sky-600 underline dark:text-sky-400"
              href={todo.link}
              target="_blank"
              rel="noreferrer"
            >
              link
            </a>
          </>
        )}
      </span>
    </li>
  )
}

function NewTaskSheet({
  projectId,
  open,
  onClose,
}: {
  projectId: string
  open: boolean
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('feature')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await createTask(projectId, { title, type, description })
      setTitle('')
      setDescription('')
      setType('feature')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New task">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          autoFocus
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex gap-2">
          {CREATABLE.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`btn flex-1 border ${type === t ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100' : 'border-slate-300 dark:border-slate-700'}`}
            >
              {TASK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <textarea
          className="input min-h-28"
          placeholder="What should the session do? Context, constraints, links…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn-primary w-full" type="submit" disabled={busy || !title.trim()}>
          Queue task
        </button>
      </form>
    </Sheet>
  )
}

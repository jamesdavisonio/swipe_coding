// Typed live queries over Firestore onSnapshot, plus the handful of writes the UI makes.
// Every write here is James acting from the UI: author is always 'james'.
import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  COLLECTIONS,
  forJamesTaskId,
  subtasksFor,
  type AgentDoc,
  type Comment,
  type Project,
  type Subtask,
  type Task,
  type TaskStatus,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { db } from './firebase.ts'

export interface Live<T> {
  data: T
  loading: boolean
  error: string | null
}

// --- read hooks ---------------------------------------------------------------
// `deps` controls re-subscription; constraints are rebuilt only when deps change.

export function useCollection<T>(
  name: string,
  constraints: QueryConstraint[],
  deps: unknown[],
  enabled = true
): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: enabled, error: null })
  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const q = query(collection(db, name), ...constraints)
    return onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })),
          loading: false,
          error: null,
        }),
      (err) => setState({ data: [], loading: false, error: err.message })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, enabled, ...deps])
  return state
}

export function useDocument<T>(name: string, id: string | null | undefined): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: !!id, error: null })
  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      doc(db, name, id),
      (snap) =>
        setState({
          data: snap.exists() ? { ...(snap.data() as T), id: snap.id } : null,
          loading: false,
          error: null,
        }),
      (err) => setState({ data: null, loading: false, error: err.message })
    )
  }, [name, id])
  return state
}

// Projects, most recently touched first (single-field index).
export const useProjects = () =>
  useCollection<Project>(COLLECTIONS.projects, [orderBy('updatedAt', 'desc')], [])

// Everything waiting on James across projects — composite index tasks(status, updatedAt desc).
export const useWaitingTasks = () =>
  useCollection<Task>(
    COLLECTIONS.tasks,
    [where('status', '==', 'waiting_on_james'), orderBy('updatedAt', 'desc')],
    []
  )

// Recent tasks across all projects for the home-page counters (single-field orderBy).
export const useRecentTasks = (max = 500) =>
  useCollection<Task>(COLLECTIONS.tasks, [orderBy('updatedAt', 'desc'), limit(max)], [max])

// A project's tasks — composite index tasks(projectId, updatedAt desc).
export const useProjectTasks = (projectId: string | undefined) =>
  useCollection<Task>(
    COLLECTIONS.tasks,
    [where('projectId', '==', projectId), orderBy('updatedAt', 'desc')],
    [projectId],
    !!projectId
  )

// Open todos everywhere (single equality) — counted per project client-side.
export const useOpenTodos = () =>
  useCollection<Todo>(COLLECTIONS.todos, [where('done', '==', false)], [])

// A project's todos; sorted client-side so no composite index is needed.
export const useProjectTodos = (projectId: string | undefined) =>
  useCollection<Todo>(
    COLLECTIONS.todos,
    [where('projectId', '==', projectId)],
    [projectId],
    !!projectId
  )

// Thread for a task — composite index comments(taskId, createdAt).
export const useTaskComments = (taskId: string | undefined) =>
  useCollection<Comment>(
    COLLECTIONS.comments,
    [where('taskId', '==', taskId), orderBy('createdAt', 'asc')],
    [taskId],
    !!taskId
  )

export const useProject = (id: string | undefined) => useDocument<Project>(COLLECTIONS.projects, id)
export const useTask = (id: string | undefined) => useDocument<Task>(COLLECTIONS.tasks, id)
export const useAgent = (id: string | null | undefined) =>
  useDocument<AgentDoc>(COLLECTIONS.agents, id)

// --- writes ------------------------------------------------------------------

const now = () => Date.now()

export async function renameProject(projectId: string, name: string) {
  await updateDoc(doc(db, COLLECTIONS.projects, projectId), { name, updatedAt: now() })
}

export async function createTask(
  projectId: string,
  input: { title: string; type: TaskType; description: string }
) {
  const ref = doc(collection(db, COLLECTIONS.tasks))
  const t = now()
  const task: Task = {
    id: ref.id,
    projectId,
    agentId: null,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    status: 'queued',
    summary: '',
    prUrl: null,
    branch: null,
    createdBy: 'james',
    createdAt: t,
    updatedAt: t,
    subtasks: subtasksFor(input.type),
    openQuestion: null,
    lastCommentAt: null,
  }
  await setDoc(ref, task)
  await touchProject(projectId)
  return ref.id
}

export async function setTaskStatus(task: Task, status: TaskStatus) {
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), {
    status,
    updatedAt: now(),
    ...(status === 'queued' ? { agentId: null } : {}),
  })
}

// A comment from James. If the task was waiting on him, it is now unblocked.
export async function addComment(task: Task, body: string) {
  const ref = doc(collection(db, COLLECTIONS.comments))
  const t = now()
  const comment: Comment = {
    id: ref.id,
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind: task.openQuestion ? 'answer' : 'comment',
    body: body.trim(),
    createdAt: t,
    deliveredAt: null,
  }
  await setDoc(ref, comment)
  const patch: Partial<Task> = { lastCommentAt: t, updatedAt: t }
  if (task.status === 'waiting_on_james') {
    patch.status = 'in_progress'
    patch.openQuestion = null
  }
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), patch)
}

export async function approveSubtask(task: Task, key: string) {
  const subtasks: Subtask[] = task.subtasks.map((s) =>
    s.key === key ? { ...s, status: 'done' } : s
  )
  const label = task.subtasks.find((s) => s.key === key)?.label ?? key
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), { subtasks, updatedAt: now() })
  await addComment({ ...task, openQuestion: task.openQuestion ?? 'approval' }, `Approved: ${label}`)
}

export async function toggleTodo(todo: Todo) {
  await updateDoc(doc(db, COLLECTIONS.todos, todo.id), {
    done: !todo.done,
    doneAt: todo.done ? null : now(),
  })
}

export async function addTodo(projectId: string, body: string) {
  const ref = doc(collection(db, COLLECTIONS.todos))
  const todo: Todo = {
    id: ref.id,
    projectId,
    body: body.trim(),
    link: null,
    done: false,
    sourceTaskId: null,
    createdAt: now(),
    doneAt: null,
  }
  await setDoc(ref, todo)
}

async function touchProject(projectId: string) {
  await updateDoc(doc(db, COLLECTIONS.projects, projectId), { updatedAt: now() }).catch(() => {})
}

export { forJamesTaskId }

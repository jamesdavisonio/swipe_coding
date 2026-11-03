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
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  COLLECTIONS,
  forJamesTaskId,
  initialTaskFields,
  isDone,
  isQueued,
  taskStages,
  type AgentDoc,
  type Comment,
  type CommentKind,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { db } from './firebase.ts'
import type { LegacyStatus } from './lib/legacy-status.ts'

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
  const task = initialTaskFields({
    projectId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    createdBy: 'james',
    afterDeploy: [],
    now: now(),
  })
  await setDoc(ref, task)
  await touchProject(projectId)
  return ref.id
}

// James's comment in the shape every writer uses; delivery stamps are the agent's to set.
function jamesComment(task: Task, kind: CommentKind, body: string, t: number, id: string): Comment {
  return {
    id,
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body: body.trim(),
    createdAt: t,
    deliveredAt: null,
    workingAt: null,
    handledAt: null,
  }
}

// A stage transition James owns: read the task inside a transaction and write only when
// `plan` accepts its current state, so a double tap (or a stale screen) is a no-op. The
// optional comment is created in the same transaction. Returns whether anything was written.
interface Transition {
  patch: Partial<Task>
  comment?: { kind: CommentKind; body: string }
}
async function transitionTask(
  taskId: string,
  plan: (current: Task) => Transition | null
): Promise<boolean> {
  const taskRef = doc(db, COLLECTIONS.tasks, taskId)
  const commentRef = doc(collection(db, COLLECTIONS.comments))
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(taskRef)
    if (!snap.exists()) return false
    const current = { ...(snap.data() as Task), id: snap.id }
    const next = plan(current)
    if (!next) return false
    const t = now()
    const { comment } = next
    tx.update(taskRef, {
      ...next.patch,
      updatedAt: t,
      ...(comment ? { lastCommentAt: t } : {}),
    })
    if (comment)
      tx.set(commentRef, jamesComment(current, comment.kind, comment.body, t, commentRef.id))
    return true
  })
}

// The Phase 1 menu actions (mark done, re-queue, reopen) expressed on stage and doneAt, each
// guarded on the stage it expects: done only when not done, reopen only from done, re-queue
// only when the type has a stage chain and the task is not already queued.
export async function setTaskStatus(task: Task, status: LegacyStatus) {
  await transitionTask(task.id, (cur) => {
    const chain = taskStages(cur)
    if (status === 'done')
      return isDone(cur) ? null : { patch: { stage: 'done', doneAt: now(), needs: null } }
    if (status === 'queued')
      return chain.length === 0 || isQueued({ ...cur, agentId: null })
        ? null
        : {
            patch: { stage: chain[0], agentId: null, needs: null, doneAt: null, working: false },
          }
    if (status === 'in_progress')
      return isDone(cur) && chain.length > 1
        ? { patch: { stage: chain[chain.length - 2], doneAt: null, reopenedAt: now() } }
        : null
    return null
  })
}

// A comment from James. If the task was waiting on him, it is now unblocked (need cleared).
export async function addComment(task: Task, body: string) {
  const ref = doc(collection(db, COLLECTIONS.comments))
  const t = now()
  const kind = task.needs?.kind === 'question' ? 'answer' : 'comment'
  await setDoc(ref, jamesComment(task, kind, body, t, ref.id))
  const patch: Partial<Task> = { lastCommentAt: t, updatedAt: t }
  if (task.needs) patch.needs = null
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), patch)
}

// Approve only while the spec is what the task waits on (stage spec or approved).
export async function approveSpec(task: Task) {
  await transitionTask(task.id, (cur) =>
    (cur.stage === 'spec' || cur.stage === 'approved') && cur.needs?.kind === 'spec'
      ? {
          patch: { stage: 'build', needs: null },
          comment: { kind: 'approve', body: 'Approved: spec' },
        }
      : null
  )
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

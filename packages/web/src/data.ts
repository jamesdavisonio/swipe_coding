// Typed live queries over Firestore onSnapshot, plus the handful of writes the UI makes.
// Every write here is James acting from the UI: author is always 'james'.
import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  COLLECTIONS,
  appendLog,
  forJamesTaskId,
  initialTaskFields,
  type AgentDoc,
  type Comment,
  type CommentKind,
  type LogEntry,
  type Project,
  type Task,
  type TaskType,
  type Todo,
} from '@kanban/shared'
import { db } from './firebase.ts'
import { log } from './lib/log.ts'
import {
  MAX_COMMENT_CHARS,
  MAX_DESCRIPTION_CHARS,
  MAX_STEPS,
  MAX_STEP_CHARS,
  MAX_TITLE_CHARS,
  MAX_TODO_CHARS,
} from './lib/limits.ts'
import { jamesComment, replyKind } from './lib/messages.ts'
import { MAX_REOPEN_NOTE_CHARS, REOPEN_PREFIX, stageBeforeDone } from './lib/reopen.ts'
import { newRequestId } from './lib/request-id.ts'
import { specVersion } from './lib/threads.ts'

export interface Live<T> {
  data: T
  loading: boolean
  error: string | null
  // Re-subscribe after a failed read.
  retry: () => void
}

// A rejected read is logged here, once per rejection, so every screen gets it for free.
// Only the error code goes into the context: messages can quote document paths and ids.
function logReadFailed(source: string, err: { code?: string }) {
  log.error('api_call_failed', `Firestore read failed: ${source}`, {
    feature: 'web-threads',
    target: 'firestore',
    action: 'read',
    status: err.code ?? 'unknown',
    request_id: newRequestId(),
  })
}

// Each hook keeps `{ data, loading, error }` in state; `retry` bumps a counter that is part
// of the effect's dependencies, which tears the listener down and subscribes again.
type LiveState<T> = Omit<Live<T>, 'retry'>
function useRetry(): [number, () => void] {
  const [attempt, setAttempt] = useState(0)
  return [attempt, useCallback(() => setAttempt((n) => n + 1), [])]
}

const LOG_ARCHIVE = 'log_archive'

// --- read hooks ---------------------------------------------------------------
// `deps` controls re-subscription; constraints are rebuilt only when deps change.

export function useCollection<T>(
  name: string,
  constraints: QueryConstraint[],
  deps: unknown[],
  enabled = true
): Live<T[]> {
  const [state, setState] = useState<LiveState<T[]>>({ data: [], loading: enabled, error: null })
  const [attempt, retry] = useRetry()
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
      (err) => {
        logReadFailed(name, err)
        setState({ data: [], loading: false, error: err.message })
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, enabled, attempt, ...deps])
  return { ...state, retry }
}

export function useDocument<T>(name: string, id: string | null | undefined): Live<T | null> {
  const [state, setState] = useState<LiveState<T | null>>({
    data: null,
    loading: !!id,
    error: null,
  })
  const [attempt, retry] = useRetry()
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
      (err) => {
        logReadFailed(name, err)
        setState({ data: null, loading: false, error: err.message })
      }
    )
  }, [name, id, attempt])
  return { ...state, retry }
}

// Projects, most recently touched first (single-field index).
export const useProjects = () =>
  useCollection<Project>(COLLECTIONS.projects, [orderBy('updatedAt', 'desc')], [])

// Every task, newest first (single-field index). Visibility and filters are client-side.
export const useAllTasks = () =>
  useCollection<Task>(COLLECTIONS.tasks, [orderBy('updatedAt', 'desc')], [])

// Every agent, for the live dot on a project (online = recent heartbeat).
export const useAgents = () => useCollection<AgentDoc>(COLLECTIONS.agents, [], [])

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

// A task's archived history (tasks/{id}/log_archive), oldest first. Reads nothing until `enabled`
// (the History sheet asks for it on "Show earlier history"). Single-field index on `at`.
export const useLogArchive = (taskId: string | undefined, enabled: boolean) =>
  useCollection<LogEntry>(
    `${COLLECTIONS.tasks}/${taskId}/${LOG_ARCHIVE}`,
    [orderBy('at', 'asc')],
    [taskId],
    enabled && !!taskId
  )

export const useProject = (id: string | undefined) => useDocument<Project>(COLLECTIONS.projects, id)
export const useTask = (id: string | undefined) => useDocument<Task>(COLLECTIONS.tasks, id)

// --- writes ------------------------------------------------------------------

const now = () => Date.now()

// Free text from James: trimmed and capped before it is written anywhere. A text that gets a
// prefix in his message is capped so the whole message fits, which keeps the message and the
// history line on the same words.
const cleanText = (text: string, max = MAX_COMMENT_CHARS): string =>
  text.trim().slice(0, max).trimEnd()

export interface NewTaskInput {
  type: TaskType
  title: string
  description: string
  afterDeploy: string[]
}

// "Queued: <title>", plus the number of after-deploy steps when there are any.
function queuedEntry(title: string, steps: number): string {
  if (steps === 0) return `Queued: ${title}`
  return `Queued: ${title} · ${steps} after-deploy ${steps === 1 ? 'step' : 'steps'}`
}

// James queues a task for the next session in a project: the shared initial shape (first stage of
// its chain, bound to no agent), his text trimmed and capped, one history line by him, and the
// project touched so it moves up the list. One batch, so the task and the touch land together
// (or, offline, are queued together). A blank title writes nothing and rejects. Returns the id.
export async function createTask(projectId: string, input: NewTaskInput): Promise<string> {
  const title = cleanText(input.title, MAX_TITLE_CHARS)
  if (title === '') throw new Error('A task needs a title')
  const steps = input.afterDeploy
    .map((step) => cleanText(step, MAX_STEP_CHARS))
    .filter((step) => step !== '')
    .slice(0, MAX_STEPS)
  const t = now()
  const ref = doc(collection(db, COLLECTIONS.tasks))
  const task = initialTaskFields({
    projectId,
    type: input.type,
    title,
    description: cleanText(input.description, MAX_DESCRIPTION_CHARS),
    createdBy: 'james',
    afterDeploy: steps,
    now: t,
  })
  const entry: LogEntry = { at: t, who: 'james', text: queuedEntry(title, steps.length) }
  const batch = writeBatch(db)
  batch.set(ref, { ...task, log: [entry] })
  batch.update(doc(db, COLLECTIONS.projects, projectId), { updatedAt: t })
  await batch.commit()
  return ref.id
}

// A decision James makes: read the task inside a transaction and write only when `plan` accepts
// its current state, so a double tap (or a stale screen) is a no-op. The plan names what changes
// on the task, the one history line, and James's message; all of it lands in this transaction.
// The history goes through appendLog; whatever it pushes past LOG_CAP is moved to
// tasks/{id}/log_archive in the same write, one document per entry.
interface Transition {
  patch: Partial<Task>
  history: string
  comment: { kind: CommentKind; body: string }
}
async function transitionTask(
  taskId: string,
  plan: (current: Task, at: number) => Transition | null
): Promise<void> {
  const taskRef = doc(db, COLLECTIONS.tasks, taskId)
  const commentRef = doc(collection(db, COLLECTIONS.comments))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(taskRef)
    if (!snap.exists()) return
    const current = { ...(snap.data() as Task), id: snap.id }
    const t = now()
    const next = plan(current, t)
    if (!next) return
    const entry: LogEntry = { at: t, who: 'james', text: next.history }
    const { log: kept, archived } = appendLog(Array.isArray(current.log) ? current.log : [], entry)
    const archive = collection(db, COLLECTIONS.tasks, taskId, LOG_ARCHIVE)
    for (const old of archived) tx.set(doc(archive), { at: old.at, who: old.who, text: old.text })
    tx.update(taskRef, { ...next.patch, log: kept, updatedAt: t, lastCommentAt: t })
    tx.set(
      commentRef,
      jamesComment(current, next.comment.kind, next.comment.body, t, commentRef.id)
    )
  })
}

const CHANGE_PREFIX = 'Change: '

// A fresh comment id, generated on the device before anything is written, so the screen can show
// the message at once and a retried write lands on the same document instead of a duplicate.
export const newCommentId = (): string => doc(collection(db, COLLECTIONS.comments)).id

// James's reply from the composer. The comment is written under `id`, trimmed and capped. When
// the task is waiting on a question the comment is the answer (kind `answer`) and the need is
// cleared in the same write; otherwise it is a plain `comment` and the need stays. A batch, not
// a transaction: a transaction cannot run offline, a batch is queued and committed on return.
export async function sendReply(task: Task, reply: { id: string; body: string }) {
  const kind = replyKind(task)
  const t = now()
  const batch = writeBatch(db)
  batch.set(
    doc(db, COLLECTIONS.comments, reply.id),
    jamesComment(task, kind, reply.body, t, reply.id)
  )
  batch.update(doc(db, COLLECTIONS.tasks, task.id), {
    lastCommentAt: t,
    updatedAt: t,
    ...(kind === 'answer' ? { needs: null } : {}),
  })
  await batch.commit()
}

// Approve only while the spec is what the task waits on (stage spec or approved).
export async function approveSpec(task: Task) {
  await transitionTask(task.id, (cur) =>
    (cur.stage === 'spec' || cur.stage === 'approved') && cur.needs?.kind === 'spec'
      ? {
          patch: { stage: 'build', needs: null },
          history: `Approved spec v${specVersion(cur)}`,
          comment: { kind: 'approve', body: 'Approved.' },
        }
      : null
  )
}

// "Small change…": the need is cleared and the stage stays, so the session revises the spec.
// Empty text writes nothing.
export async function requestChange(task: Task, text: string) {
  const change = cleanText(text, MAX_COMMENT_CHARS - CHANGE_PREFIX.length)
  if (change === '') return
  await transitionTask(task.id, (cur) =>
    cur.needs?.kind === 'spec'
      ? {
          patch: { needs: null },
          history: `Asked for a change to spec v${specVersion(cur)}: ${change}`,
          comment: { kind: 'change_request', body: `${CHANGE_PREFIX}${change}` },
        }
      : null
  )
}

// An answer: an option (its key must still be on offer) or James's own words (label only). His
// message carries the label and the need is cleared; only while the task still waits on a
// question, so a double tap or a stale option writes nothing.
export async function answerQuestion(task: Task, answer: { key?: string; label: string }) {
  const label = cleanText(answer.label)
  if (label === '') return
  await transitionTask(task.id, (cur) => {
    const need = cur.needs
    if (need?.kind !== 'question') return null
    if (answer.key !== undefined && !need.options?.some((o) => o.key === answer.key)) return null
    return {
      patch: { needs: null },
      history: need.question ? `Answered ${need.question}: ${label}` : `Answered: ${label}`,
      comment: { kind: 'answer', body: label },
    }
  })
}

// "Merged it": only from stage `pr`, so a second tap (or a stale row) writes nothing.
export async function markMerged(task: Task) {
  await transitionTask(task.id, (cur) =>
    cur.stage === 'pr'
      ? {
          patch: { stage: 'merged', needs: null },
          history: cur.pr ? `Merged PR #${cur.pr.number}` : 'Merged the PR',
          comment: { kind: 'merged', body: 'Merged it.' },
        }
      : null
  )
}

// Reopens a done task with a note for the session: only from stage `done` (a double tap or a stale
// screen writes nothing), back to the stage before `done` in the task's own chain, re-arming the
// after-deploy need when that is where it lands. `afterDone` stays as it is: James unticks the
// step himself. A blank note writes nothing.
export async function reopenTask(task: Task, note: string) {
  const text = cleanText(note, MAX_REOPEN_NOTE_CHARS)
  if (text === '') return
  await transitionTask(task.id, (cur, at) => {
    const back = cur.stage === 'done' ? stageBeforeDone(cur) : null
    if (back === null) return null
    return {
      patch: {
        stage: back,
        needs: back === 'after_deploy' ? { kind: 'after_deploy' } : null,
        doneAt: null,
        reopenedAt: at,
      },
      history: `${REOPEN_PREFIX}${text}`,
      comment: { kind: 'reopen', body: `${REOPEN_PREFIX}${text}` },
    }
  })
}

// Ticks (or unticks) one after-deploy step. A batch built from the task as the screen has it, so
// a tick made offline is queued and shows at once. History goes in with arrayUnion (the next
// transactional writer enforces LOG_CAP). The tick that leaves every step done also closes the
// task: stage done, doneAt, need and working cleared, the "Done" history line and James's
// closing message, all in the same batch.
export async function tickStep(task: Task, index: number) {
  const steps = Array.isArray(task.afterDeploy) ? task.afterDeploy : []
  if (
    task.stage !== 'after_deploy' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= steps.length
  )
    return
  const afterDone = steps.map((_, i) =>
    i === index ? !task.afterDone?.[i] : !!task.afterDone?.[i]
  )
  const t = now()
  const ticked = afterDone[index]
  const step: LogEntry = {
    at: t,
    who: 'james',
    text: `${ticked ? 'Step done' : 'Step unticked'}: ${steps[index]}`,
  }
  const batch = writeBatch(db)
  const taskRef = doc(db, COLLECTIONS.tasks, task.id)
  if (afterDone.every(Boolean)) {
    const commentRef = doc(collection(db, COLLECTIONS.comments))
    const closed: LogEntry = { at: t, who: 'system', text: 'Done' }
    batch.update(taskRef, {
      afterDone,
      log: arrayUnion(step, closed),
      stage: 'done',
      doneAt: t,
      needs: null,
      working: false,
      updatedAt: t,
      lastCommentAt: t,
    })
    batch.set(
      commentRef,
      jamesComment(task, 'comment', 'After-deploy steps done.', t, commentRef.id)
    )
  } else {
    batch.update(taskRef, { afterDone, log: arrayUnion(step), updatedAt: t })
  }
  await batch.commit()
}

// Opening a thread clears its unread flag. updatedAt stays put so the row does not jump.
export async function markRead(task: Task) {
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), { unread: false })
}

export async function toggleTodo(todo: Todo) {
  await updateDoc(doc(db, COLLECTIONS.todos, todo.id), {
    done: !todo.done,
    doneAt: todo.done ? null : now(),
  })
}

// A hand-done item James adds to a project's For James list: trimmed, capped, never blank (a
// blank text writes nothing and rejects).
export async function addTodo(projectId: string, body: string) {
  const text = cleanText(body, MAX_TODO_CHARS)
  if (text === '') throw new Error('A to-do needs some text')
  const ref = doc(collection(db, COLLECTIONS.todos))
  const todo: Todo = {
    id: ref.id,
    projectId,
    body: text,
    link: null,
    done: false,
    sourceTaskId: null,
    createdAt: now(),
    doneAt: null,
  }
  await setDoc(ref, todo)
}

export { forJamesTaskId }

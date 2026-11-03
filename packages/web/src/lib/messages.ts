// Pure helpers behind the thread's message list: how a comment is labelled, which session
// message carries Read more, and how James's not-yet-confirmed replies join the saved ones.
// No React, no Firestore.
import {
  TASK_TYPES,
  taskStages,
  type Comment,
  type CommentKind,
  type Stage,
  type Task,
  type TaskNeed,
} from '@kanban/shared'
import { MAX_COMMENT_CHARS } from './limits.ts'
import { isDateable, relativeTime } from './threads.ts'

const KIND_LABEL: Record<string, string> = {
  spec: 'Spec',
  question: 'Question',
  pr: 'PR ready',
  after_deploy: 'After deploy',
  done: 'Done',
}
const OTHER_KIND_LABEL = 'Session'

export type MessageShape = 'system' | 'james' | 'session'

// Where a comment sits: a quiet centred line, James on the right, any other session message.
export function messageShape(comment: Pick<Comment, 'author' | 'kind'>): MessageShape {
  if (comment.author === 'james') return 'james'
  return comment.kind === 'system' ? 'system' : 'session'
}

// "Spec", "Question", "PR ready", "After deploy", "Done"; "Session" for info or anything this
// app does not know (a kind from a newer session must still render).
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? OTHER_KIND_LABEL

// "<Kind> · <relative time>"; the time is left out when the comment has no usable timestamp.
export function sessionLabel(comment: Pick<Comment, 'kind' | 'createdAt'>, now: number): string {
  const kind = kindLabel(comment.kind)
  return isDateable(comment.createdAt) ? `${kind} · ${relativeTime(comment.createdAt, now)}` : kind
}

// James's relative time under his message, '' when the comment has no usable timestamp.
export const sentTime = (comment: Pick<Comment, 'createdAt'>, now: number): string =>
  isDateable(comment.createdAt) ? relativeTime(comment.createdAt, now) : ''

// The one session message that carries Read more: the latest whose kind is the kind of need the
// task has open. Earlier messages of that kind are history.
export function readMoreId(comments: readonly Comment[], need: TaskNeed | null): string | null {
  if (!need) return null
  for (let i = comments.length - 1; i >= 0; i--)
    if (comments[i].author !== 'james' && comments[i].kind === need.kind) return comments[i].id
  return null
}

// The comment's text; a document with a missing or non-string body shows an empty bubble
// instead of taking the thread down.
export const bodyText = (comment: Pick<Comment, 'body'>): string =>
  typeof comment.body === 'string' ? comment.body : ''

// What a reply from the composer is: the answer when the task waits on a question, else a
// plain comment.
export const replyKind = (task: Pick<Task, 'needs'>): CommentKind =>
  task.needs?.kind === 'question' ? 'answer' : 'comment'

// James's comment in the one shape every writer and the screen's optimistic copy use: body
// trimmed and capped, no delivery stamps (the agent's to set), so it reads "sent".
export function jamesComment(
  task: Pick<Task, 'id' | 'projectId' | 'agentId'>,
  kind: CommentKind,
  body: string,
  at: number,
  id: string
): Comment {
  return {
    id,
    taskId: task.id,
    projectId: task.projectId,
    agentId: task.agentId,
    author: 'james',
    kind,
    body: body.trim().slice(0, MAX_COMMENT_CHARS),
    createdAt: at,
    deliveredAt: null,
    workingAt: null,
    handledAt: null,
  }
}

// The saved comments plus every pending reply the snapshot does not hold yet, oldest first.
// Matching is by id, never by text, so the same text sent twice shows twice. The sort is
// stable, so equal timestamps keep their order.
export function mergeMessages(saved: readonly Comment[], pending: readonly Comment[]): Comment[] {
  const known = new Set(saved.map((c) => c.id))
  const all = [...saved, ...pending.filter((c) => !known.has(c.id))]
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

// The task's stage chain, safe on a half-migrated document (no afterDeploy list, a type this
// app does not know): such a task shows no stepper rather than crashing the thread.
export function stagesOf(task: Pick<Task, 'type' | 'afterDeploy'>): Stage[] {
  if (!TASK_TYPES.includes(task.type)) return []
  const afterDeploy = Array.isArray(task.afterDeploy) ? task.afterDeploy : []
  return taskStages({ type: task.type, afterDeploy })
}

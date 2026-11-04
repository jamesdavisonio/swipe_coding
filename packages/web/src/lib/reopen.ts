// Pure helpers behind Reopen: where a done task goes back to, what the Reopen sheet says about
// it, and the quiet "Reopened by you" lines the thread derives from the decision history. No
// React, no Firestore.
import { STAGE_LABEL, type Comment, type Stage, type Task } from '@kanban/shared'
import { MAX_COMMENT_CHARS } from './limits.ts'
import { stagesOf } from './messages.ts'
import { isDateable } from './threads.ts'

// The text that opens both the history line and James's message, so the two carry the same words.
export const REOPEN_PREFIX = 'Reopened: '
// The note is capped so the whole message (prefix included) fits the comment limit.
export const MAX_REOPEN_NOTE_CHARS = MAX_COMMENT_CHARS - REOPEN_PREFIX.length
export const REOPENED_BY_YOU = 'Reopened by you'

// The stage before `done` in the task's own chain; null when the chain has none (a for_james
// task, a type this app does not know).
export function stageBeforeDone(task: Pick<Task, 'type' | 'afterDeploy'>): Stage | null {
  const chain = stagesOf(task)
  const at = chain.indexOf('done')
  return at > 0 ? chain[at - 1] : null
}

const SENT_TO_SESSION = 'Your note is sent to the session.'

// Where the task goes back to, as the Reopen sheet says it.
export function reopenLine(task: Pick<Task, 'type' | 'afterDeploy'>): string {
  const back = stageBeforeDone(task)
  if (back === 'after_deploy')
    return `Goes back to the after-deploy checklist so you can untick a step. ${SENT_TO_SESSION}`
  if (back === null) return SENT_TO_SESSION
  return `Goes back to ${STAGE_LABEL[back]}. Your note is sent to the session as the first thing it reads.`
}

// One quiet system line per reopen James made, at the time of its history entry. Not stored: the
// rules keep system lines agent-only, so the line is derived from the history the write left.
export function reopenLines(task: Pick<Task, 'id' | 'projectId' | 'agentId' | 'log'>): Comment[] {
  const log = Array.isArray(task.log) ? task.log : []
  return log
    .filter(
      (entry) =>
        entry?.who === 'james' &&
        typeof entry.text === 'string' &&
        entry.text.startsWith(REOPEN_PREFIX) &&
        isDateable(entry.at)
    )
    .map((entry, index) => ({
      id: `reopened:${entry.at}:${index}`,
      taskId: task.id,
      projectId: task.projectId,
      agentId: task.agentId,
      author: 'agent',
      kind: 'system',
      body: REOPENED_BY_YOU,
      createdAt: entry.at,
      deliveredAt: null,
      workingAt: null,
      handledAt: null,
    }))
}

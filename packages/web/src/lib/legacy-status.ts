// Phase 1 pages still show what the retired `status` and `subtasks` fields expressed. This
// derives the same words from the stage model so they keep rendering until the Threads
// screens (B2-B6) replace them; nothing here is new behaviour.
import {
  STAGE_LABEL,
  isDone,
  taskPhase,
  taskStages,
  type Task,
  type TaskPhase,
} from '@kanban/shared'

export type LegacyStatus = TaskPhase

export const legacyStatus = (task: Task): LegacyStatus => taskPhase(task)

export interface LegacyStep {
  key: string
  label: string
  status: 'pending' | 'in_progress' | 'awaiting_approval' | 'done'
}

// The task's stage chain as the step list: stages before the current one are done, the
// current one is in progress (or awaiting approval while the spec need is open).
export function legacySteps(task: Task): LegacyStep[] {
  const chain = taskStages(task)
  const current = isDone(task) ? chain.length : chain.indexOf(task.stage)
  return chain.map((stage, i) => ({
    key: stage,
    label: STAGE_LABEL[stage],
    status:
      i < current
        ? 'done'
        : i > current
          ? 'pending'
          : task.needs?.kind === 'spec'
            ? 'awaiting_approval'
            : 'in_progress',
  }))
}

// What the task is waiting on James for, as the old openQuestion box showed it.
export function needText(task: Task): string | null {
  switch (task.needs?.kind) {
    case 'question':
      return task.needs.question ?? 'The session has a question for you.'
    case 'spec':
      return 'The spec is ready for your approval.'
    case 'pr':
      return 'The PR is ready for you.'
    case 'after_deploy':
      return 'The after-deploy steps are waiting for you.'
    default:
      return null
  }
}

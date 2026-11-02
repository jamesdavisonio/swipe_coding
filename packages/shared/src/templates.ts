import type { Subtask, TaskType } from './index.ts'

// Subtask templates per task type. The agent advances them with kanban_subtask;
// `awaiting_approval` steps light up an Approve button on the phone.
export const TASK_TEMPLATES: Record<TaskType, { key: string; label: string }[]> = {
  feature: [
    { key: 'spec', label: 'Write spec' },
    { key: 'spec_approved', label: 'Spec approved by James' },
    { key: 'implement', label: 'Implement' },
    { key: 'pr_open', label: 'Open PR' },
    { key: 'done', label: 'Done' },
  ],
  bugfix: [
    { key: 'reproduce', label: 'Reproduce' },
    { key: 'fix', label: 'Fix' },
    { key: 'pr_open', label: 'Open PR' },
    { key: 'done', label: 'Done' },
  ],
  chore: [
    { key: 'do', label: 'Do it' },
    { key: 'done', label: 'Done' },
  ],
  for_james: [],
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  feature: 'Feature',
  bugfix: 'Bug fix',
  chore: 'Chore',
  for_james: 'For James',
}

export function subtasksFor(type: TaskType): Subtask[] {
  return TASK_TEMPLATES[type].map((t) => ({ key: t.key, label: t.label, status: 'pending' }))
}

// Every project gets exactly one pinned task of this type; its id is derived so
// agents and the UI can address it without a query.
export function forJamesTaskId(projectId: string): string {
  return `for-james-${projectId}`
}

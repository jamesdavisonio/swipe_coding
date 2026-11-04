// Pure helpers behind the New task form: the after-deploy steps from the textarea and the stage
// preview. No React, no Firestore.
import { STAGE_LABEL, stagesFor, type TaskType } from '@kanban/shared'

// The types James can queue (the pinned For James type is the session's).
export const QUEUEABLE_TYPES = ['feature', 'bugfix', 'chore'] as const satisfies readonly TaskType[]
export type QueueableType = (typeof QUEUEABLE_TYPES)[number]

// One step per line, each trimmed, blank lines dropped.
export function parseSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

// "Stages: Spec → Approved → …" for the task as it would be saved.
export function stagePreview(type: TaskType, steps: readonly string[]): string {
  const labels = stagesFor(type, steps.length > 0).map((stage) => STAGE_LABEL[stage])
  return `Stages: ${labels.join(' → ')}`
}

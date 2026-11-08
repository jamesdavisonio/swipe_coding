// Decision notices (docs/features/decision-notifications.md). Red-checkpoint stub: signatures only.
import type { Task } from './index.ts'

export type DecisionKind = 'spec' | 'ci_failed' | 'fix' | 'round' | 'summary_gate' | 'question'

export interface DecisionNotice {
  kind: DecisionKind
  title: string
  body: string
  tag: string
  url: string
}

export function decisionNotice(
  _task: Pick<Task, 'id' | 'title' | 'stage' | 'needs'>,
  _projectName: string,
  _specBody?: string
): DecisionNotice | null {
  return null
}

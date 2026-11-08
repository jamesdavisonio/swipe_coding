// Decision cards: what kind a decision James is asked for is and what its headline says (what yes
// does). One derivation, two readers: the deck's cards (packages/web/src/lib/deck.ts) and the
// phone notification the agent sends for the same decision (docs/features/decision-notifications.md).
// Pure text in, plain data out. Question and brief text come from a session, so they go through
// parseBrief, which reads anything unexpected as "no brief".
import { briefHeadline, parseBrief, type Brief } from './brief.ts'
import type { Stage, Task, TaskNeed } from './index.ts'

export type DecisionKind = 'spec' | 'ci_failed' | 'fix' | 'round' | 'summary_gate' | 'question'

// The kind written as a word: a card's label and the first part of a notification's title.
export const DECISION_LABEL: Record<DecisionKind, string> = {
  ci_failed: 'CI failed',
  spec: 'Spec',
  fix: 'Fix',
  round: 'Another round',
  summary_gate: 'Ship it',
  question: 'Question',
}

export const HEADLINE_MAX = 60
const ELLIPSIS = '…'

// A headline that fits the card: over HEADLINE_MAX characters it is cut, ending in "…".
export const fitHeadline = (text: string): string =>
  text.length > HEADLINE_MAX ? `${text.slice(0, HEADLINE_MAX - 1)}${ELLIPSIS}` : text

// A fix brief at one of these stages proposes a fix for a failed CI run.
const CI_STAGES: readonly Stage[] = ['pr', 'merged', 'main_ci']

// What a gate card's headline says when its brief has no Yes: line.
const FALLBACK_PREFIX: Partial<Record<DecisionKind, string>> = {
  ci_failed: 'Fix CI',
  fix: 'Fix it',
  round: 'Another round',
  summary_gate: 'Ship it',
}

// A decision as the deck and the notification show it. `headline` is not yet cut to fit.
export interface Decision {
  kind: DecisionKind
  headline: string
  brief: Brief | null
}

// The brief a question is, when the session asked it as one (fix, round and summary briefs).
export const questionBrief = (need: Pick<TaskNeed, 'question'>): Brief | null =>
  typeof need.question === 'string' ? parseBrief(need.question) : null

// What a question's sheet is titled: the brief's headline, or the question as asked.
export function questionTitle(task: Pick<Task, 'title'>, need: Pick<TaskNeed, 'question'>): string {
  const brief = questionBrief(need)
  return brief ? briefHeadline(brief, task.title) : need.question || 'Question'
}

// The kind a question is: a gate brief's own kind (a fix brief once the PR is up is a failed
// CI's fix), otherwise a plain question.
function questionKind(stage: Stage, brief: Brief | null): DecisionKind {
  switch (brief?.gate) {
    case 'fix':
      return CI_STAGES.includes(stage) ? 'ci_failed' : 'fix'
    case 'round':
      return 'round'
    case 'summary':
      return 'summary_gate'
    default:
      return 'question'
  }
}

// A question: its kind, and the brief's Yes: phrase as the headline, else "<prefix>: <title>" for
// a gate kind, else the question's title.
export function questionDecision(
  task: Pick<Task, 'title' | 'stage'>,
  need: Pick<TaskNeed, 'question'>
): Decision {
  const brief = questionBrief(need)
  const kind = questionKind(task.stage, brief)
  const prefix = FALLBACK_PREFIX[kind]
  const fallback = prefix ? `${prefix}: ${task.title}` : questionTitle(task, need)
  return { kind, headline: brief?.yes ?? fallback, brief }
}

// A spec waiting for approval: the spec brief's Yes: phrase, else "Start building: <title>".
// `body` is the spec brief's text when it is known; a brief of another gate does not count.
export function specDecision(task: Pick<Task, 'title'>, body: string | undefined): Decision {
  const parsed = body === undefined ? null : parseBrief(body)
  const brief = parsed?.gate === 'spec' ? parsed : null
  return { kind: 'spec', headline: brief?.yes ?? `Start building: ${task.title}`, brief }
}

export interface DecisionNotice {
  kind: DecisionKind
  title: string
  body: string
  tag: string
  url: string
}

// Between a notification title's kind and project: a middle dot with a space on each side.
const TITLE_SEPARATOR = ' · '

// The decision a task waits on, if it waits on one (a merge or after-deploy steps are not).
function waitingDecision(
  task: Pick<Task, 'title' | 'stage' | 'needs'>,
  specBody: string | undefined
): Decision | null {
  const need = task.needs
  if (need?.kind === 'spec') return specDecision(task, specBody)
  if (need?.kind === 'question') return questionDecision(task, need)
  return null
}

// The phone notification for the decision a task waits on: titled "<kind> · <project>", the
// card's headline as its text, tagged per task (a later decision on the task replaces it) and
// opening the deck on that task. Null when the task waits on no decision.
export function decisionNotice(
  task: Pick<Task, 'id' | 'title' | 'stage' | 'needs'>,
  projectName: string,
  specBody?: string
): DecisionNotice | null {
  const decision = waitingDecision(task, specBody)
  if (!decision) return null
  return {
    kind: decision.kind,
    title: `${DECISION_LABEL[decision.kind]}${TITLE_SEPARATOR}${projectName}`,
    body: fitHeadline(decision.headline),
    tag: `decision:${task.id}`,
    url: `/?task=${encodeURIComponent(task.id)}`,
  }
}

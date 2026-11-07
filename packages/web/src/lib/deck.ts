// The swipe deck's cards: one for each thing waiting on James, in the order he decides them.
// Pure data in, plain cards out: no React, no Firestore. Brief text comes from sessions, so every
// brief goes through lib/brief.ts, which reads anything unexpected as "no brief".
import type { Project, Task, TaskNeed, Todo } from '@kanban/shared'
import { LIST_MARKER, parseBrief, suggestedNext, type Brief } from './brief.ts'
import {
  activeNeed,
  isListed,
  prName,
  questionBrief,
  questionOptions,
  questionTitle,
  specVersion,
  stepCount,
} from './threads.ts'

export const HEADLINE_MAX = 60
export type CardKind =
  | 'ci_failed'
  | 'merge'
  | 'spec'
  | 'fix'
  | 'round'
  | 'summary_gate'
  | 'question'
  | 'after_deploy'
  | 'todos'
  | 'summary'
  | 'next'
export const KIND_ORDER: readonly CardKind[] = [
  'ci_failed',
  'merge',
  'spec',
  'fix',
  'round',
  'summary_gate',
  'question',
  'after_deploy',
  'todos',
  'summary',
  'next',
]
// The card's type, written as a word as well as shown by its colour.
export const KIND_LABEL: Record<CardKind, string> = {
  ci_failed: 'CI failed',
  merge: 'Merge',
  spec: 'Spec',
  fix: 'Fix',
  round: 'Another round',
  summary_gate: 'Ship it',
  question: 'Question',
  after_deploy: 'After deploy',
  todos: 'To-do',
  summary: 'Done',
  next: 'Suggested next',
}
export interface DeckChoice {
  key?: string
  label: string
  recommended: boolean
}
export type DeckAction =
  | { type: 'approve' }
  | { type: 'phrase'; phrase: string }
  | { type: 'choose' }
  | { type: 'merge' }
  | { type: 'tick_all' }
  | { type: 'todos_done' }
  | { type: 'read' }
  | { type: 'queue' }
export interface DeckCard {
  id: string
  kind: CardKind
  taskId: string | null
  projectId: string
  projectName: string
  session: string
  headline: string
  example: string | null
  choices: DeckChoice[]
  action: DeckAction | null
  important: boolean
  at: number
  passed: boolean
  revised: boolean
  steps: { label: string; done: boolean }[]
  todoIds: string[]
  suggestion: string | null
  brief: Brief | null
}
export interface DeckInput {
  tasks: readonly Task[]
  todos: readonly Todo[]
  projects: readonly Project[]
  specBodies: Readonly<Record<string, string>>
  handledNext: readonly string[]
  passed: readonly string[]
  now: number
}

const ELLIPSIS = '…'
const EXAMPLE_LEAD = 'For example,'
// Where a part's prose breaks into sentences: after . ! or ?, and before a list item (a part's
// lines are joined with spaces, so "- …" or "1. …" items run on in one line).
const SENTENCE_BREAK = /(?<=[.!?])\s+|\s+(?=(?:[-*]|\d+\.)\s)/
// A fix brief at one of these stages proposes a fix for a failed CI run.
const CI_STAGES: readonly string[] = ['pr', 'merged', 'main_ci']

// ---- words --------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// A headline that fits the card: over HEADLINE_MAX characters it is cut, ending in "…".
const fitHeadline = (text: string): string =>
  text.length > HEADLINE_MAX ? `${text.slice(0, HEADLINE_MAX - 1)}${ELLIPSIS}` : text

// The "For example," sentence of the brief's "What will change" part (a list item's too, its
// marker dropped), without the lead-in and starting with a capital letter; null when none.
export function exampleOf(brief: Brief | null): string | null {
  if (!brief) return null
  const sentence = brief.parts.changes
    .split(SENTENCE_BREAK)
    .map((s) => s.replace(LIST_MARKER, ''))
    .find((s) => s.startsWith(EXAMPLE_LEAD))
  const example = sentence?.slice(EXAMPLE_LEAD.length).trim()
  return example ? capitalised(example) : null
}

// What the card's two stamps say while it is dragged: right names its action, left what a pass
// does ("Use the mic" when there is no action, so a right drag springs back).
const YES_STAMP: Record<Exclude<DeckAction['type'], 'phrase'>, string> = {
  approve: 'Build it',
  choose: 'Choose',
  merge: 'Merge',
  tick_all: 'All done',
  todos_done: 'All done',
  read: 'Got it',
  queue: 'Start it',
}
const NO_ACTION_STAMP = 'Use the mic'
const LATER_STAMP: Partial<Record<CardKind, string>> = {
  next: 'Not now',
  summary: 'Nothing to dismiss',
}
export function stampText(card: Pick<DeckCard, 'kind' | 'action'>): {
  yes: string
  later: string
} {
  const { action } = card
  const yes = !action
    ? NO_ACTION_STAMP
    : action.type === 'phrase'
      ? capitalised(action.phrase)
      : YES_STAMP[action.type]
  return { yes, later: LATER_STAMP[card.kind] ?? 'Later' }
}

// ---- cards --------------------------------------------------------------------------

type CardBase = Pick<DeckCard, 'projectId' | 'projectName'>
type CardFields = Pick<DeckCard, 'id' | 'kind' | 'taskId' | 'session' | 'headline' | 'at'> &
  Partial<DeckCard>

// A card with every field the contract names; `fields` override the quiet defaults.
function card(base: CardBase, fields: CardFields): DeckCard {
  const brief = fields.brief ?? null
  return {
    example: exampleOf(brief),
    choices: [],
    action: null,
    important: false,
    revised: false,
    steps: [],
    todoIds: [],
    suggestion: null,
    passed: false,
    ...base,
    ...fields,
    brief,
    headline: fitHeadline(fields.headline),
  }
}

type TaskCardFields = Pick<DeckCard, 'kind' | 'headline'> & Partial<DeckCard>

// A card about one task: id "<kind>:<task id>", the task's title as the session, and asked when
// the task last changed, unless `fields` say otherwise.
function taskCard(base: CardBase, task: Task, fields: TaskCardFields): DeckCard {
  return card(base, {
    id: `${fields.kind}:${task.id}`,
    taskId: task.id,
    session: task.title,
    at: task.updatedAt,
    ...fields,
  })
}

// The card kind a question is: a gate brief's own kind (a fix brief once the PR is up is a
// failed CI's fix), otherwise a plain question.
function questionKind(task: Task, brief: Brief | null): CardKind {
  switch (brief?.gate) {
    case 'fix':
      return CI_STAGES.includes(task.stage) ? 'ci_failed' : 'fix'
    case 'round':
      return 'round'
    case 'summary':
      return 'summary_gate'
    default:
      return 'question'
  }
}

const FALLBACK_PREFIX: Partial<Record<CardKind, string>> = {
  ci_failed: 'Fix CI',
  fix: 'Fix it',
  round: 'Another round',
  summary_gate: 'Ship it',
}

// Two or more options are a choice (the first recommended); a brief's Reply line is its phrase.
function questionAnswers(
  need: TaskNeed,
  brief: Brief | null
): Pick<DeckCard, 'action' | 'choices'> {
  const options = questionOptions(need)
  if (options.length >= 2) {
    const choices = options.map((o, i) => ({ key: o.key, label: o.label, recommended: i === 0 }))
    return { action: { type: 'choose' }, choices }
  }
  if (brief?.replyPhrase)
    return { action: { type: 'phrase', phrase: brief.replyPhrase }, choices: [] }
  return { action: null, choices: [] }
}

function questionCard(base: CardBase, task: Task, need: TaskNeed): DeckCard {
  const brief = questionBrief(need)
  const kind = questionKind(task, brief)
  const prefix = FALLBACK_PREFIX[kind]
  const fallback = prefix ? `${prefix}: ${task.title}` : questionTitle(task, need)
  return taskCard(base, task, {
    kind,
    headline: brief?.yes ?? fallback,
    brief,
    ...questionAnswers(need, brief),
  })
}

function specCard(base: CardBase, task: Task, body: string | undefined): DeckCard {
  const parsed = body === undefined ? null : parseBrief(body)
  const brief = parsed?.gate === 'spec' ? parsed : null
  return taskCard(base, task, {
    kind: 'spec',
    headline: brief?.yes ?? `Start building: ${task.title}`,
    brief,
    action: { type: 'approve' },
    revised: specVersion(task) > 1,
  })
}

function mergeCard(base: CardBase, task: Task): DeckCard {
  return taskCard(base, task, {
    kind: 'merge',
    headline: `Merge ${prName(task)} into main`,
    action: { type: 'merge' },
    important: true,
  })
}

function afterDeployCard(base: CardBase, task: Task): DeckCard {
  const steps = Array.isArray(task.afterDeploy) ? task.afterDeploy : []
  const count = stepCount(task)
  return taskCard(base, task, {
    kind: 'after_deploy',
    headline: `Do the ${plural(count, 'after-deploy step', 'after-deploy steps')}`,
    action: { type: 'tick_all' },
    steps: steps.map((label, i) => ({ label, done: task.afterDone?.[i] === true })),
  })
}

// The card for what the task waits on, if anything.
function needCard(base: CardBase, task: Task, input: DeckInput): DeckCard | null {
  const need = activeNeed(task)
  switch (need?.kind) {
    case 'spec':
      return specCard(base, task, input.specBodies[task.id])
    case 'question':
      return questionCard(base, task, need)
    case 'pr':
      return mergeCard(base, task)
    case 'after_deploy':
      return afterDeployCard(base, task)
    default:
      return null
  }
}

const doneAt = (task: Task): number => task.doneAt ?? task.updatedAt

function summaryCard(base: CardBase, task: Task): DeckCard {
  return taskCard(base, task, {
    kind: 'summary',
    headline: `Done: ${task.title}`,
    at: doneAt(task),
    brief: typeof task.summary === 'string' ? parseBrief(task.summary) : null,
    action: { type: 'read' },
  })
}

// One card per Suggested next line of a finished task, except those handled on this phone.
function nextCards(base: CardBase, task: Task, handled: Set<string>): DeckCard[] {
  const lines = typeof task.summary === 'string' ? suggestedNext(task.summary) : []
  return lines
    .map((suggestion, index) => ({ suggestion, id: `next:${task.id}:${index}` }))
    .filter(({ id }) => !handled.has(id))
    .map(({ suggestion, id }) =>
      taskCard(base, task, {
        id,
        kind: 'next',
        headline: suggestion,
        at: doneAt(task),
        action: { type: 'queue' },
        suggestion,
      })
    )
}

// One card per project with open to-dos, listing them oldest first.
function todoCards(input: DeckInput, base: (projectId: string) => CardBase): DeckCard[] {
  const open = new Map<string, Todo[]>()
  for (const todo of input.todos) {
    if (!todo.done) open.set(todo.projectId, [...(open.get(todo.projectId) ?? []), todo])
  }
  return [...open].map(([projectId, list]) => {
    const todos = [...list].sort((a, b) => a.createdAt - b.createdAt)
    const b = base(projectId)
    return card(b, {
      id: `todos:${projectId}`,
      kind: 'todos',
      taskId: null,
      session: b.projectName,
      headline: plural(todos.length, 'thing only you can do', 'things only you can do'),
      at: todos[0].createdAt,
      action: { type: 'todos_done' },
      steps: todos.map((t) => ({ label: t.body, done: false })),
      todoIds: todos.map((t) => t.id),
    })
  })
}

// ---- order --------------------------------------------------------------------------

const byKindThenAge = (a: DeckCard, b: DeckCard) =>
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.at - b.at

// Kinds in KIND_ORDER, the oldest first inside a kind, each summary directly followed by its
// task's next cards; next cards of a task with no summary card come last, oldest first.
function ordered(cards: readonly DeckCard[]): DeckCard[] {
  const next = cards.filter((c) => c.kind === 'next')
  const rest = cards.filter((c) => c.kind !== 'next').sort(byKindThenAge)
  const summarised = new Set(rest.filter((c) => c.kind === 'summary').map((c) => c.taskId))
  const result = rest.flatMap((c) =>
    c.kind === 'summary' ? [c, ...next.filter((n) => n.taskId === c.taskId)] : [c]
  )
  return [...result, ...next.filter((n) => !summarised.has(n.taskId)).sort(byKindThenAge)]
}

// Cards passed on this phone go after all the others, in the order they were passed, marked.
function passedLast(cards: readonly DeckCard[], passed: readonly string[]): DeckCard[] {
  const waiting = cards.filter((c) => !passed.includes(c.id))
  const later = passed.flatMap((id) => cards.filter((c) => c.id === id))
  return [...waiting, ...later.map((c) => ({ ...c, passed: true }))]
}

// Every card a listed task makes: what it waits on, and once done its summary (while unread)
// and its suggestions.
function taskCards(task: Task, base: CardBase, input: DeckInput, handled: Set<string>) {
  const need = needCard(base, task, input)
  const cards = need ? [need] : []
  if (task.stage !== 'done') return cards
  if (task.unread === true) cards.push(summaryCard(base, task))
  return [...cards, ...nextCards(base, task, handled)]
}

export function buildDeck(input: DeckInput): DeckCard[] {
  const names = new Map(input.projects.map((p) => [p.id, p.name]))
  const handled = new Set(input.handledNext)
  const base = (projectId: string): CardBase => ({
    projectId,
    projectName: names.get(projectId) ?? projectId,
  })
  const cards = [
    ...todoCards(input, base),
    ...input.tasks
      .filter((task) => isListed(task, input.now))
      .flatMap((task) => taskCards(task, base(task.projectId), input, handled)),
  ]
  return passedLast(ordered(cards), input.passed)
}

// The project's cards first, then the rest, each group keeping its order.
export function projectFirst(cards: readonly DeckCard[], projectId: string): DeckCard[] {
  return [
    ...cards.filter((c) => c.projectId === projectId),
    ...cards.filter((c) => c.projectId !== projectId),
  ]
}

// How many cards are waiting: by kind (in KIND_ORDER, kinds with none left out) and by project
// (in deck order, each with its kinds in KIND_ORDER).
export interface DeckOverview {
  total: number
  byKind: { kind: CardKind; count: number }[]
  byProject: { projectId: string; projectName: string; count: number; kinds: CardKind[] }[]
}
export function deckOverview(cards: readonly DeckCard[]): DeckOverview {
  const kindsOf = (list: readonly DeckCard[]) =>
    KIND_ORDER.map((kind) => ({ kind, count: list.filter((c) => c.kind === kind).length })).filter(
      (k) => k.count > 0
    )
  const byProject = [...new Set(cards.map((c) => c.projectId))].map((projectId) => {
    const mine = cards.filter((c) => c.projectId === projectId)
    const kinds = kindsOf(mine).map((k) => k.kind)
    return { projectId, projectName: mine[0].projectName, count: mine.length, kinds }
  })
  return { total: cards.length, byKind: kindsOf(cards), byProject }
}

// Red-checkpoint stub (fix next-card-context).
export const SUGGESTION_SEPARATOR = ' — '
export function splitSuggestion(line: string): { what: string; why: string | null } {
  return { what: line, why: null }
}

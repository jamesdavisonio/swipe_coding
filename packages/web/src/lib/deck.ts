// The swipe deck's cards: one for each thing waiting on James, in the order he decides them.
// Pure data in, plain cards out: no React, no Firestore. Brief text comes from sessions, so every
// brief goes through lib/brief.ts, which reads anything unexpected as "no brief". A decision
// card's kind and headline come from @kanban/shared, which the agent's notifications also use.
import {
  DECISION_LABEL,
  HEADLINE_MAX,
  MERGE_LABEL,
  fitHeadline,
  questionDecision,
  specDecision,
  type DecisionKind,
  type Project,
  type Task,
  type TaskNeed,
} from '@kanban/shared'
import { LIST_MARKER, parseBrief, suggestedNext, type Brief } from './brief.ts'
import {
  activeNeed,
  isListed,
  prName,
  questionOptions,
  specVersion,
  stepCount,
  webUrl,
} from './threads.ts'

export { HEADLINE_MAX }
// To-dos are no card: they live in the deck's to-do drawer (lib/todo-drawer.ts).
export type CardKind = DecisionKind | 'merge' | 'after_deploy' | 'summary' | 'next'
// Most important first (James, 2026-11-07): decisions, then merges, then hand work, then finished
// work, then every suggestion.
export const KIND_ORDER: readonly CardKind[] = [
  'ci_failed',
  'spec',
  'fix',
  'round',
  'summary_gate',
  'question',
  'merge',
  'after_deploy',
  'summary',
  'next',
]
// The card's type, written as a word as well as shown by its colour.
export const KIND_LABEL: Record<CardKind, string> = {
  ...DECISION_LABEL,
  merge: MERGE_LABEL,
  after_deploy: 'After deploy',
  summary: 'Done',
  next: 'Suggested next',
}
// A web page the card points to, opened in a new tab (a merge card's pull request on GitHub).
export interface DeckLink {
  label: string
  href: string
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
  link: DeckLink | null
  at: number
  passed: boolean
  revised: boolean
  steps: { label: string; done: boolean }[]
  // A next card's whole Suggested next line, and the reason it gives (null without one).
  suggestion: string | null
  why: string | null
  brief: Brief | null
}
export interface DeckInput {
  tasks: readonly Task[]
  projects: readonly Project[]
  specBodies: Readonly<Record<string, string>>
  handledNext: readonly string[]
  passed: readonly string[]
  now: number
}

// Between what a Suggested next line asks for and why: an em dash with a space on each side.
export const SUGGESTION_SEPARATOR = ' — '
const EXAMPLE_LEAD = 'For example,'
// Where a part's prose breaks into sentences: after . ! or ?, and before a list item (a part's
// lines are joined with spaces, so "- …" or "1. …" items run on in one line).
const SENTENCE_BREAK = /(?<=[.!?])\s+|\s+(?=(?:[-*]|\d+\.)\s)/

// ---- words --------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

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
  merge: 'I merged it',
  tick_all: 'All done',
  read: 'Got it',
  queue: 'Start it',
}
const NO_ACTION_STAMP = 'Use the mic'
const LATER_STAMP: Partial<Record<CardKind, string>> = {
  next: 'Skip',
  summary: 'Dismiss',
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
    link: null,
    revised: false,
    steps: [],
    suggestion: null,
    why: null,
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
  const decision = questionDecision(task, need)
  return taskCard(base, task, { ...decision, ...questionAnswers(need, decision.brief) })
}

function specCard(base: CardBase, task: Task, body: string | undefined): DeckCard {
  return taskCard(base, task, {
    ...specDecision(task, body),
    action: { type: 'approve' },
    revised: specVersion(task) > 1,
  })
}

// The pull request's page on GitHub, for a web url only (http or https).
function prLink(task: Task): DeckLink | null {
  const href = webUrl(task.pr?.url)
  return href && task.pr ? { label: `Open PR #${task.pr.number} on GitHub`, href } : null
}

// James merges on GitHub (the card's link) and agreeing tells the session it is merged.
function mergeCard(base: CardBase, task: Task): DeckCard {
  return taskCard(base, task, {
    kind: 'merge',
    headline: `Merge ${prName(task)} into main`,
    action: { type: 'merge' },
    important: true,
    link: prLink(task),
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

// A Suggested next line `<what> — <why>`, split at the first separator, both parts trimmed. A line
// without the separator (or with nothing after it) is all "what", with no why.
export function splitSuggestion(line: string): { what: string; why: string | null } {
  // Lines arrive trimmed, so "Add X — " reaches here as "Add X —": the separator with nothing after.
  const bare = SUGGESTION_SEPARATOR.trimEnd()
  const trimmed = line.trimEnd()
  if (trimmed.endsWith(bare)) return { what: trimmed.slice(0, -bare.length).trim(), why: null }
  const at = line.indexOf(SUGGESTION_SEPARATOR)
  if (at < 0) return { what: line.trim(), why: null }
  const why = line.slice(at + SUGGESTION_SEPARATOR.length).trim()
  return { what: line.slice(0, at).trim(), why: why === '' ? null : why }
}

// What starting a next card queues: a task titled with the line's "what", its description saying
// why (when the line gives a reason) and which session suggested it.
export function suggestedTask(card: Pick<DeckCard, 'suggestion' | 'why' | 'session'>): {
  title: string
  description: string
} | null {
  if (!card.suggestion) return null
  const by = `Suggested by ${card.session}`
  return {
    title: splitSuggestion(card.suggestion).what,
    description: card.why ? `${card.why}\n\n${by}` : by,
  }
}

// One card per Suggested next line of a finished task, except those a later session retired
// (on every device) and those handled on this phone.
function nextCards(base: CardBase, task: Task, handled: Set<string>): DeckCard[] {
  const lines = typeof task.summary === 'string' ? suggestedNext(task.summary) : []
  const retired = new Set(Array.isArray(task.retiredNext) ? task.retiredNext : [])
  return lines
    .map((suggestion, index) => ({ suggestion, index, id: `next:${task.id}:${index}` }))
    .filter(({ index, id }) => !retired.has(index) && !handled.has(id))
    .map(({ suggestion, id }) => {
      const { what, why } = splitSuggestion(suggestion)
      return taskCard(base, task, {
        id,
        kind: 'next',
        headline: what,
        at: doneAt(task),
        action: { type: 'queue' },
        suggestion,
        why,
      })
    })
}

// ---- order --------------------------------------------------------------------------

const byKindThenAge = (a: DeckCard, b: DeckCard) =>
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.at - b.at

// Kinds in KIND_ORDER, the oldest first inside a kind; every next card comes last.
function ordered(cards: readonly DeckCard[]): DeckCard[] {
  return [...cards].sort(byKindThenAge)
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
  const cards = input.tasks
    .filter((task) => isListed(task, input.now))
    .flatMap((task) => taskCards(task, base(task.projectId), input, handled))
  return passedLast(ordered(cards), input.passed)
}

// The cards `pick` chooses first, then the rest, each group keeping its order.
const firstWhere = (cards: readonly DeckCard[], pick: (c: DeckCard) => boolean): DeckCard[] => [
  ...cards.filter(pick),
  ...cards.filter((c) => !pick(c)),
]

// The project's cards first, then the rest, each group keeping its order.
export const projectFirst = (cards: readonly DeckCard[], projectId: string): DeckCard[] =>
  firstWhere(cards, (c) => c.projectId === projectId)

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

// That task's cards first, then the rest, each group keeping its order (a notification opens the
// deck on its task this way). A task with no cards leaves the order as it is.
export const taskFirst = (cards: readonly DeckCard[], taskId: string): DeckCard[] =>
  firstWhere(cards, (c) => c.taskId === taskId)

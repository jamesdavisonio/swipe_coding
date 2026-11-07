// Red-checkpoint stub: the contract's names, no behaviour yet.
import type { Project, Task, Todo } from '@kanban/shared'
import type { Brief } from './brief.ts'

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
export const KIND_ORDER: readonly CardKind[] = []
export const KIND_LABEL = {} as Record<CardKind, string>
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
export function buildDeck(_input: DeckInput): DeckCard[] {
  return []
}
export function projectFirst(cards: readonly DeckCard[], _projectId: string): DeckCard[] {
  return [...cards]
}
export function deckOverview(_cards: readonly DeckCard[]) {
  return {
    total: 0,
    byKind: [] as { kind: CardKind; count: number }[],
    byProject: [] as { projectId: string; projectName: string; count: number; kinds: CardKind[] }[],
  }
}
export function exampleOf(_brief: Brief | null): string | null {
  return null
}

// What each move does to the top card. Every write goes through `track` (as Threads' taps do),
// so a failed one is logged under the tap's request id; the card leaves at once and comes back
// if the write fails.
import type { NeedKind, Task } from '@kanban/shared'
import {
  answerQuestion,
  approveSpec,
  markMerged,
  markRead,
  queueSuggestion,
  sendNote,
  tickRemainingSteps,
} from '../../data.ts'
import { stampText, suggestedTask, type DeckCard, type DeckChoice } from '../../lib/deck.ts'
import { activeNeed } from '../../lib/threads.ts'
import { track } from '../../lib/use-thread-actions.ts'
import type { Ghost } from './CardStage.tsx'
import { buzz, HAPTIC } from './motion.ts'
import type { DeckModel } from './use-deck.ts'
import type { Drag } from './use-swipe.ts'

interface Write {
  action: string
  run: () => Promise<unknown>
}

export interface DeckUi {
  fly: (card: DeckCard, to: Ghost['to'], from: Drag | null) => void
  toast: (text: string) => void
  openSheet: (kind: 'choices' | 'skip', card: DeckCard) => void
  closeSheet: () => void
}

interface Ctx {
  deck: DeckModel
  ui: DeckUi
}

const FAILED = "Couldn't send that. The card is back."
// The needs a note answers, so its own write leaves the task waiting on nothing (data.ts sendNote).
const NOTE_CLEARS_NEED: readonly NeedKind[] = ['spec', 'question', 'pr']

// The write a card's right swipe makes; null for the moves that open a sheet first.
function writeOf(card: DeckCard, task: Task | null): Write | null {
  const action = card.action
  if (!action) return null
  if (action.type === 'queue') {
    const queued = suggestedTask(card)
    return queued
      ? {
          action: 'queue_suggestion',
          run: () => queueSuggestion(card.projectId, queued.title, queued.description),
        }
      : null
  }
  if (!task) return null
  switch (action.type) {
    case 'approve':
      return { action: 'approve_spec', run: () => approveSpec(task) }
    case 'phrase':
      return { action: 'gate_reply', run: () => answerQuestion(task, { label: action.phrase }) }
    case 'merge':
      return { action: 'mark_merged', run: () => markMerged(task) }
    case 'tick_all':
      return { action: 'tick_all_steps', run: () => tickRemainingSteps(task) }
    case 'read':
      return { action: 'mark_read', run: () => markRead(task) }
    default:
      return null
  }
}

function sentText(card: DeckCard): string {
  if (card.kind === 'next') return 'A new task is queued.'
  if (card.kind === 'summary') return 'Got it.'
  if (card.kind === 'merge') return `Told ${card.session} it's merged.`
  return `Sent to ${card.session}: ${stampText(card).yes.toLowerCase()}.`
}

// The card leaves now and the write runs; a failure brings the card back. A suggested-next card
// that went through is remembered as handled on this phone.
function commit(
  { deck, ui }: Ctx,
  card: DeckCard,
  write: Write,
  motion: { to: Ghost['to']; from: Drag | null }
) {
  buzz(HAPTIC.commit)
  ui.fly(card, motion.to, motion.from)
  deck.hide(card.id)
  void track(write.action, card.taskId ?? card.projectId, write.run).then((ok) => {
    if (!ok) {
      deck.unhide(card.id)
      ui.toast(FAILED)
      return
    }
    if (card.kind === 'next') deck.memory.handleNext(card.id)
    ui.toast(sentText(card))
  })
}

function refuse(ui: DeckUi, why: string) {
  buzz(HAPTIC.refused)
  ui.toast(why)
}

function agree(ctx: Ctx, card: DeckCard, from: Drag | null) {
  const action = card.action
  if (!action) return refuse(ctx.ui, 'Answer this one with the mic.')
  if (action.type === 'choose') return ctx.ui.openSheet('choices', card)
  const write = writeOf(card, ctx.deck.taskOf(card.taskId))
  if (write) commit(ctx, card, write, { to: 'right', from })
}

// Left: the card goes behind the others; a done card is dismissed (marked read, as a right drag
// does); a suggested-next card asks first whether to skip it for now or for good.
function later(ctx: Ctx, card: DeckCard, from: Drag | null) {
  if (card.kind === 'summary') return dismiss(ctx, card, from)
  if (card.kind === 'next') return ctx.ui.openSheet('skip', card)
  pass(ctx, card, from, `Later. ${card.session} keeps waiting.`)
}

// A done card dragged left: the same write as agreeing to it, flying out to the left.
function dismiss(ctx: Ctx, card: DeckCard, from: Drag | null) {
  const write = writeOf(card, ctx.deck.taskOf(card.taskId))
  if (write) commit(ctx, card, write, { to: 'left', from })
}

// The card flies left and is passed on this phone: it comes back after the others.
function pass({ deck, ui }: Ctx, card: DeckCard, from: Drag | null, toast: string) {
  ui.fly(card, 'left', from)
  deck.memory.pass(card.id)
  ui.toast(toast)
}

// The skip sheet's answers. Neither writes to the board: "for now" passes the card like any other,
// "never" drops it from this phone for good (as a started suggestion is).
function skip(ctx: Ctx, card: DeckCard, forGood: boolean) {
  const { deck, ui } = ctx
  ui.closeSheet()
  if (!forGood) return pass(ctx, card, null, 'Skipped. It comes back after the others.')
  ui.fly(card, 'left', null)
  deck.memory.handleNext(card.id)
  ui.toast('Dropped from this phone.')
}

function choose(ctx: Ctx, card: DeckCard, choice: DeckChoice) {
  const task = ctx.deck.taskOf(card.taskId)
  ctx.ui.closeSheet()
  if (!task) return
  const answer =
    choice.key === undefined ? { label: choice.label } : { key: choice.key, label: choice.label }
  const write = { action: 'answer', run: () => answerQuestion(task, answer) }
  commit(ctx, card, write, { to: 'right', from: null })
}

// A voice note: the card goes up and away. A suggested-next card is queued (titled with what it
// suggests) with the note as its description; anything else goes to the session, and the deck
// waits for its revised card.
function note(ctx: Ctx, card: DeckCard, text: string) {
  const { deck, ui } = ctx
  ui.closeSheet()
  const queued = card.kind === 'next' ? suggestedTask(card) : null
  if (queued) {
    const run = () => queueSuggestion(card.projectId, queued.title, text)
    commit(ctx, card, { action: 'queue_suggestion', run }, { to: 'up', from: null })
    return
  }
  const task = deck.taskOf(card.taskId)
  if (!task) return
  buzz(HAPTIC.commit)
  ui.fly(card, 'up', null)
  // A note that clears the need can be told from the session's revision right away; one that
  // leaves it (a comment) only once its own write is through (see use-waiting.ts).
  const clears = NOTE_CLEARS_NEED.some((kind) => kind === activeNeed(task)?.kind)
  deck.waiting.add(task.id, card.session, clears ? task.updatedAt : null)
  void track('voice_note', task.id, () => sendNote(task, text)).then((ok) => {
    if (ok) {
      if (!clears) deck.waiting.settle(task.id)
      return
    }
    deck.waiting.remove(task.id)
    ui.toast(FAILED)
  })
}

export function useDeckActions(deck: DeckModel, ui: DeckUi) {
  const ctx = { deck, ui }
  return {
    agree: (card: DeckCard, from: Drag | null) => agree(ctx, card, from),
    later: (card: DeckCard, from: Drag | null) => later(ctx, card, from),
    skip: (card: DeckCard, forGood: boolean) => skip(ctx, card, forGood),
    choose: (card: DeckCard, choice: DeckChoice) => choose(ctx, card, choice),
    note: (card: DeckCard, text: string) => note(ctx, card, text),
  }
}

export type DeckActions = ReturnType<typeof useDeckActions>

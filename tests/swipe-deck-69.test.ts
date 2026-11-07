// swipe-deck 69: the session instructions tell sessions to post every question they end a turn on
// to the board with kanban_ask (options, recommended first), create a task first if needed, and
// record a chat answer with kanban_answered_in_session. Runs with `npm test` (no Firestore).
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

describe('swipe-deck 69: SESSION_INSTRUCTIONS', () => {
  it.each([
    'also post that question on the board',
    'kanban_create_task',
    'kanban_answered_in_session',
    'recommended one first',
    'no board task yet',
    'giving the choices as options',
  ])('contains "%s"', (phrase) => {
    expect(SESSION_INSTRUCTIONS).toContain(phrase)
  })
})

// swipe-deck 68: the session instructions tell sessions to retire the suggestions their work has
// done with `retire_suggestions`, and to keep hand-done work out of Suggested next. Runs with
// `npm test` (no Firestore).
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

describe('swipe-deck 68: SESSION_INSTRUCTIONS', () => {
  it.each(['retire_suggestions', 'never under Suggested next'])('contains "%s"', (phrase) => {
    expect(SESSION_INSTRUCTIONS).toContain(phrase)
  })
})

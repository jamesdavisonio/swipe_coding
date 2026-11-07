// swipe-deck 63: the session instructions tell sessions to give each Suggested next line a why.
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

describe('swipe-deck 63: SESSION_INSTRUCTIONS', () => {
  it('describes a Suggested next line as what and why', () => {
    expect(SESSION_INSTRUCTIONS).toContain(
      '<what to do> — <why it matters and what it would change>'
    )
  })
})

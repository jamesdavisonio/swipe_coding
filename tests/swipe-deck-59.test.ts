// swipe-deck 59: the session instructions every session receives carry the deck's rules: a Yes
// line of at most 60 characters, Remote Control on and off, posting the gate again after a change
// note, merging on "Merge PR #<n> into main.", and posting a fix brief when CI fails. Runs with
// `npm test` (no Firestore).
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

describe('swipe-deck 59: SESSION_INSTRUCTIONS', () => {
  it.each([
    'Yes: <phrase>',
    'at most 60 characters',
    'set_remote_control',
    'Merge PR #<n> into main.',
    'post the gate again',
    'CI fails',
    'fix confirmed',
    'set_remote_control with "self"',
    'When CI fails',
    'post a fix brief with kanban_ask',
  ])('contains "%s"', (phrase) => {
    expect(SESSION_INSTRUCTIONS).toContain(phrase)
  })
})

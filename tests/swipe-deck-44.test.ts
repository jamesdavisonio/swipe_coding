// swipe-deck 44: the card's example is the "For example," sentence of "What will change",
// without the lead-in and capitalised; null when there is none.
import { describe, expect, it } from 'vitest'
import { parseBrief } from '../packages/web/src/lib/brief.ts'
import { buildDeck, exampleOf } from '../packages/web/src/lib/deck.ts'
import { NOW, makeTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

const brief = (changes?: string) => parseBrief(briefText('fix', { changes }))

describe('swipe-deck 44: exampleOf', () => {
  it('drops the lead-in and capitalises the sentence', () => {
    expect(exampleOf(brief('For example, the lint error goes away.'))).toBe(
      'The lint error goes away.'
    )
  })

  it('takes only the example sentence out of a longer part', () => {
    expect(exampleOf(brief('Adds a button. For example, tap it to approve. Then more.'))).toBe(
      'Tap it to approve.'
    )
  })

  it('is null without an example, or without a brief', () => {
    expect(exampleOf(brief('Only a plain change.'))).toBeNull()
    expect(exampleOf(null)).toBeNull()
  })

  it('ignores a "For example," sentence in any other part', () => {
    const text = briefText('fix').replace('You asked for it.', 'For example, a sentence elsewhere.')
    expect(exampleOf(parseBrief(text))).toBeNull()
  })

  it('shows on the card', () => {
    const tasks = [
      makeTask('f', {
        stage: 'build',
        needs: {
          kind: 'question',
          question: briefText('fix', { changes: 'For example, CI turns green.' }),
        },
      }),
    ]
    const [card] = buildDeck({
      tasks,
      projects: [],
      specBodies: {},
      handledNext: [],
      passed: [],
      now: NOW,
    })
    expect(card.example).toBe('CI turns green.')
  })
})

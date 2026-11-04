// @vitest-environment jsdom
// board-briefs B7, criterion 31: a session message whose text holds a decision brief
// (`## Decision brief (<gate>)` and the six fixed sub-headings in order) renders as a labelled
// card (Spec, Fix, Another round, Summary) with the six parts under their headings, the text
// before it above and the text after it below; anything else renders exactly as today.
// parseBrief (packages/web/src/lib/brief.ts) is the pure reading of that format.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { MINUTE, NOW, installClock, makeTask } from './fixtures/web-threads-b2.tsx'
import { renderThread, sessionMsg, threadText } from './fixtures/web-threads-b3.tsx'
import { textIn } from './fixtures/web-threads-b5.tsx'
import { setB6 } from './fixtures/web-threads-b6.tsx'
import {
  GATES,
  LABEL,
  PARTS,
  PHRASE,
  SUBHEADINGS,
  briefBlock,
  briefMessage,
  expectCard,
  loadBrief,
  replyLine,
} from './fixtures/board-briefs-b7.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

// The parser, loaded inside each test (a missing module fails that test alone).
const parser = async () => (await loadBrief()).parseBrief

describe('B7-31 parseBrief reads a well-formed brief', () => {
  it.each(GATES.map((gate) => [gate]))(
    'reads a %s brief: gate, label and the six parts',
    async (gate) => {
      const parseBrief = await parser()
      const brief = parseBrief(briefBlock(gate))
      expect(brief).toMatchObject({ gate, label: LABEL[gate], before: '', after: '' })
      expect(brief?.parts).toEqual(PARTS[gate])
      expect(brief?.replyPhrase).toBeNull()
    }
  )

  it('keeps the text above the brief as before and the text below it as after, both trimmed', async () => {
    const parseBrief = await parser()
    const text = `\n  Spec v3 is ready for you.  \n\n${briefBlock('spec')}\n\n${replyLine('spec')}\n\n`
    const brief = parseBrief(text)
    expect(brief?.before).toBe('Spec v3 is ready for you.')
    expect(brief?.after).toBe(replyLine('spec'))
    expect(brief?.parts.agreeing).toBe(PARTS.spec.agreeing)
  })

  it('joins a part written over several lines with single spaces and trims it', async () => {
    const parseBrief = await parser()
    const text = briefBlock('fix').replace(
      `### Why it exists\n${PARTS.fix.why}`,
      '### Why it exists\n\n  The export skips every row\nwhen one row has a blank date.  '
    )
    expect(parseBrief(text)?.parts.why).toBe(
      'The export skips every row when one row has a blank date.'
    )
  })

  it('ends the last part at a blank line followed by a heading', async () => {
    const parseBrief = await parser()
    const below = '## Root cause\nThe export stops at the first blank date.'
    const brief = parseBrief(`${briefBlock('fix')}\n\n${below}`)
    expect(brief?.parts.agreeing).toBe(PARTS.fix.agreeing)
    expect(brief?.after).toBe(below)
  })

  it('ends the last part at a blank line followed by ---', async () => {
    const parseBrief = await parser()
    const below = '---\n\nThe full spec follows.'
    const brief = parseBrief(`${briefBlock('spec')}\n\n${below}`)
    expect(brief?.parts.agreeing).toBe(PARTS.spec.agreeing)
    expect(brief?.after).toBe(below)
  })

  it('keeps an ordinary paragraph after a blank line inside the last part', async () => {
    const parseBrief = await parser()
    const text = briefBlock('spec').replace(
      PARTS.spec.agreeing,
      'Nothing unusual.\n\nYes starts the build, which runs to a pull request.'
    )
    const brief = parseBrief(text)
    expect(brief?.parts.agreeing.replace(/\s+/g, ' ')).toBe(
      'Nothing unusual. Yes starts the build, which runs to a pull request.'
    )
    expect(brief?.after).toBe('')
  })

  it.each(GATES.map((gate) => [gate]))(
    'reads the phrase of the closing Reply line of a %s brief',
    async (gate) => {
      const parseBrief = await parser()
      expect(parseBrief(briefMessage(gate, { after: replyLine(gate) }))?.replyPhrase).toBe(
        PHRASE[gate]
      )
    }
  )

  it('finds the Reply line anywhere in the text', async () => {
    const parseBrief = await parser()
    const text = `${replyLine('round', 'go on')}\n\n${briefBlock('round')}`
    expect(parseBrief(text)?.replyPhrase).toBe('go on')
  })
})

describe('B7-31 parseBrief rejects anything that is not a well-formed brief', () => {
  it('returns null for text without a brief heading', async () => {
    const parseBrief = await parser()
    expect(parseBrief('Tests are green; opening the PR next.')).toBeNull()
    expect(parseBrief('')).toBeNull()
  })

  it('returns null for a gate other than spec, fix, round or summary', async () => {
    const parseBrief = await parser()
    expect(parseBrief(briefBlock('deploy'))).toBeNull()
    expect(parseBrief(briefBlock('spec').replace('(spec)', ''))).toBeNull()
  })

  it.each(SUBHEADINGS.map((heading) => [heading]))('returns null without "%s"', async (missing) => {
    const parseBrief = await parser()
    const headings = SUBHEADINGS.filter((h) => h !== missing)
    expect(parseBrief(briefBlock('spec', { headings }))).toBeNull()
  })

  it('returns null when the sub-headings are out of order', async () => {
    const parseBrief = await parser()
    const headings = [...SUBHEADINGS]
    ;[headings[1], headings[2]] = [headings[2], headings[1]]
    expect(parseBrief(briefBlock('fix', { headings }))).toBeNull()
  })

  it('returns null when a sub-heading has different text', async () => {
    const parseBrief = await parser()
    const headings = SUBHEADINGS.map((h) =>
      h === "What you're agreeing to" ? 'What you are agreeing to' : h
    )
    expect(parseBrief(briefBlock('summary', { headings }))).toBeNull()
  })
})

// ---- the thread -------------------------------------------------------------------------------

const BEFORE = 'Here is where things stand.'
const AFTER = 'Root cause and blast radius are in the PR description.'

const showThread = (body: string, kind = 'info') => {
  const task = makeTask('t1', { title: 'Order the replies', stage: 'build' })
  setB6(task, { comments: [sessionMsg('c1', kind, body, NOW - 5 * MINUTE)] })
  renderThread('/t/t1', <Thread />)
}

describe('B7-31 a brief in the thread renders as a labelled card', () => {
  installClock()

  it.each(GATES.map((gate) => [gate]))(
    'a %s brief shows its label as a heading and the six parts in order',
    (gate) => {
      showThread(briefMessage(gate), gate === 'spec' ? 'info' : 'question')
      expect(screen.getByRole('heading', { name: LABEL[gate] })).toBeTruthy()
      expectCard(document.body, PARTS[gate])
    }
  )

  it('shows the text before the brief above the card and the text after it below', () => {
    showThread(
      briefMessage('fix', {
        before: BEFORE,
        after: `---\n\n${AFTER}\n\n${replyLine('fix')}`,
      })
    )
    const text = threadText()
    const before = text.indexOf(BEFORE)
    const first = text.indexOf(SUBHEADINGS[0])
    const last = text.indexOf(PARTS.fix.agreeing)
    const after = text.indexOf(AFTER)
    expect(before).toBeGreaterThanOrEqual(0)
    expect(before).toBeLessThan(first)
    expect(last).toBeGreaterThan(first)
    expect(after).toBeGreaterThan(last)
    expect(text.indexOf(replyLine('fix'))).toBeGreaterThan(last)
    expectCard(document.body, PARTS.fix)
    // The card: the smallest element around the label heading that holds the last part.
    let card: HTMLElement = screen.getByRole('heading', { name: LABEL.fix })
    while (card.parentElement && !textIn(card).includes(PARTS.fix.agreeing))
      card = card.parentElement
    expect(textIn(card)).toContain(PARTS.fix.agreeing)
    expect(textIn(card)).not.toContain(AFTER)
    expect(textIn(card)).not.toContain(replyLine('fix'))
  })

  it('a message without a well-formed brief renders its text as it is, with no card', () => {
    const broken = briefBlock('spec', { headings: SUBHEADINGS.filter((_, i) => i !== 3) })
    showThread(`${BEFORE}\n\n${broken}`)
    const text = threadText()
    expect(text).toContain('## Decision brief (spec)')
    expect(text).toContain('### Where it came from')
    expect(text).toContain(BEFORE)
    expect(screen.queryByRole('heading', { name: 'Spec' })).toBeNull()
  })
})

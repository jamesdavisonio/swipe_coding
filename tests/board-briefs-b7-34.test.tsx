// @vitest-environment jsdom
// board-briefs B7, criterion 34 (the screen half): a task waiting on James's merge decision shows,
// in its PR sheet, the session's latest summary brief as a card above the B4 content (the
// summary, Open PR #<n> in GitHub, Merged it), or just its summary when it posted no brief. How a
// reported pull request raises that need is the agent's half
// (tests/emulator/board-briefs-b7-34.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Comment } from '../packages/shared/src/index.ts'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { MINUTE, NOW, installClock, isBefore } from './fixtures/web-threads-b2.tsx'
import { jamesMsg, readMoreButtons, renderThread, sessionMsg } from './fixtures/web-threads-b3.tsx'
import { prTask } from './fixtures/web-threads-b4.tsx'
import { setB6 } from './fixtures/web-threads-b6.tsx'
import {
  PARTS,
  briefMessage,
  expectCard,
  partsWith,
  posIn,
  replyLine,
} from './fixtures/board-briefs-b7.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const SUMMARY = 'Header no longer overlaps the list on small phones.'
const OLD = partsWith('First pass:', 'summary')

async function openPrSheet(comments: Comment[]) {
  setB6(prTask(), { comments })
  renderThread('/t/t1', <Thread />)
  await userEvent.setup().click(readMoreButtons()[0])
  return screen.getByRole('dialog', { name: 'PR #42 is ready to merge' })
}

describe('B7-34 the PR sheet leads with the summary brief', () => {
  installClock()

  it("shows the session's latest summary brief as a card above the PR content", async () => {
    const sheet = await openPrSheet([
      sessionMsg('c1', 'question', briefMessage('fix'), NOW - 90 * MINUTE),
      sessionMsg(
        'c2',
        'question',
        briefMessage('summary', { parts: OLD, after: replyLine('summary') }),
        NOW - 60 * MINUTE
      ),
      sessionMsg(
        'c3',
        'question',
        briefMessage('summary', { after: replyLine('summary') }),
        NOW - 30 * MINUTE
      ),
    ])
    const card = within(sheet).getByRole('heading', { name: 'Summary' })
    expectCard(sheet, PARTS.summary)
    expect(posIn(sheet, OLD.origin)).toBe(-1)
    expect(posIn(sheet, PARTS.fix.origin)).toBe(-1)
    const link = within(sheet).getByRole('link', { name: /Open PR #42 in GitHub/ })
    const merged = within(sheet).getByRole('button', { name: 'Merged it' })
    expect(isBefore(card, link)).toBe(true)
    expect(isBefore(card, merged)).toBe(true)
    expect(posIn(sheet, PARTS.summary.agreeing)).toBeLessThan(posIn(sheet, 'Merged it'))
    const summary = within(sheet).getByText(SUMMARY)
    expect(isBefore(card, summary)).toBe(true)
  })

  it('still shows the latest summary brief when plainer messages came after it', async () => {
    const sheet = await openPrSheet([
      sessionMsg(
        'c1',
        'question',
        briefMessage('summary', { after: replyLine('summary') }),
        NOW - 60 * MINUTE
      ),
      jamesMsg('c2', 'ship it', NOW - 50 * MINUTE),
      sessionMsg('c3', 'info', 'PR is up.', NOW - 30 * MINUTE),
    ])
    expect(within(sheet).getByRole('heading', { name: 'Summary' })).toBeTruthy()
    expectCard(sheet, PARTS.summary)
  })

  it('shows the summary alone, with no card, when the session posted no summary brief', async () => {
    const sheet = await openPrSheet([
      sessionMsg('c1', 'question', briefMessage('fix'), NOW - 90 * MINUTE),
      sessionMsg('c2', 'info', 'PR is up.', NOW - 30 * MINUTE),
    ])
    expect(within(sheet).getByText(SUMMARY)).toBeTruthy()
    expect(within(sheet).queryByRole('heading', { name: 'Summary' })).toBeNull()
    expect(within(sheet).getByRole('button', { name: 'Merged it' })).toBeTruthy()
  })
})

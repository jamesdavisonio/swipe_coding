// @vitest-environment jsdom
// board-briefs B8 criterion 41 as it applies to B7's controls (with web-threads criterion 30):
// Full spec, Copy and the one-tap gate answers are reachable with Tab, carry an accessible name
// and work from the keyboard. (The visible focus ring is CSS that jsdom cannot render; it is
// checked at review. Listen, Stop and the microphone are B8's.)
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { MINUTE, NOW, installClock, makeTask, renderAt } from './fixtures/web-threads-b2.tsx'
import { readMoreButtons, renderThread, sessionMsg } from './fixtures/web-threads-b3.tsx'
import { actions, renderSheet, specTask, userActions } from './fixtures/web-threads-b4.tsx'
import { setB6 } from './fixtures/web-threads-b6.tsx'
import {
  PHRASE,
  briefMessage,
  replyLine,
  stubClipboard,
  tabTo,
} from './fixtures/board-briefs-b7.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const fixAsk = () =>
  makeTask('t1', {
    title: 'Export the report',
    type: 'bugfix',
    stage: 'fix',
    needs: {
      kind: 'question',
      question: briefMessage('fix', { after: replyLine('fix') }),
    },
  })

const noUnnamedControls = () => {
  expect(screen.queryAllByRole('button', { name: '' })).toEqual([])
  expect(screen.queryAllByRole('link', { name: '' })).toEqual([])
}

describe('B7-41 keyboard and names for the brief controls', () => {
  installClock()

  it('Full spec is reached with Tab and toggles with Enter', async () => {
    setB6(specTask(), {
      comments: [sessionMsg('c1', 'info', briefMessage('spec'), NOW - 5 * MINUTE)],
    })
    renderThread('/t/t1', <Thread />)
    const user = userEvent.setup()
    await user.click(readMoreButtons()[0])
    const sheet = screen.getByRole('dialog', { name: 'Spec v3 — Add search' })
    const toggle = within(sheet).getByRole('button', { name: 'Full spec' })
    await tabTo(user, toggle)
    await user.keyboard('{Enter}')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    noUnnamedControls()
  })

  it('a Copy button is reached with Tab, named by its item, and copies with Enter', async () => {
    const item = 'Add search to Projects'
    const summary = `Shipped.\n\n### Suggested next\n- ${item}`
    setB6(
      makeTask('t1', { title: 'Order the replies', stage: 'done', doneAt: NOW - MINUTE, summary }),
      { comments: [sessionMsg('c1', 'done', summary, NOW - MINUTE)] }
    )
    renderThread('/t/t1', <Thread />)
    const user = userEvent.setup()
    const writeText = stubClipboard()
    await tabTo(user, screen.getByRole('button', { name: `Copy: ${item}` }))
    await user.keyboard('{Enter}')
    expect(writeText).toHaveBeenCalledWith(item)
    noUnnamedControls()
  })

  it('the one-tap answer on a Threads row is reached with Tab and answers with Enter', async () => {
    setB6(fixAsk())
    renderAt('/', <Threads />)
    const user = userEvent.setup()
    await tabTo(user, screen.getByRole('button', { name: PHRASE.fix }))
    await user.keyboard('{Enter}')
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(actions.answerQuestion.mock.calls[0][1]).toEqual({ label: PHRASE.fix })
    expect(userActions('gate_reply')).toHaveLength(1)
    noUnnamedControls()
  })

  it('the one-tap answer in the sheet is reached with Tab and answers with Space', async () => {
    const { user } = renderSheet(DecisionSheet, fixAsk())
    const phrase = within(screen.getByRole('dialog')).getByRole('button', { name: PHRASE.fix })
    await tabTo(user, phrase)
    await user.keyboard(' ')
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(actions.answerQuestion.mock.calls[0][1]).toEqual({ label: PHRASE.fix })
    noUnnamedControls()
  })
})

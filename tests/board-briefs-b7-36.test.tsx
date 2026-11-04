// @vitest-environment jsdom
// board-briefs B7, criterion 36: a finished summary with a `### Suggested next` part (one
// suggestion per line) shows, in the thread, a list headed "You could start next" with a Copy
// button per suggestion (named `Copy: <item>`) that copies its text and shows "Copied"; nothing is
// started. suggestedNext (packages/web/src/lib/brief.ts) is the pure reading of that part.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { MINUTE, NOW, installClock, makeTask, where } from './fixtures/web-threads-b2.tsx'
import { b3Actions, renderThread, sessionMsg, threadText } from './fixtures/web-threads-b3.tsx'
import { userActions, writeCount } from './fixtures/web-threads-b4.tsx'
import { b5Actions } from './fixtures/web-threads-b5.tsx'
import { b6Actions, setB6 } from './fixtures/web-threads-b6.tsx'
import { briefMessage, loadBrief, stubClipboard } from './fixtures/board-briefs-b7.tsx'

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

// The helper, loaded inside each test (a missing module fails that test alone).
const helper = async () => (await loadBrief()).suggestedNext

describe('B7-36 suggestedNext reads the Suggested next part', () => {
  it('takes one suggestion per line, without list markers, trimmed, blanks dropped', async () => {
    const suggestedNext = await helper()
    const text = [
      'Shipped the ordered replies.',
      '',
      '### Suggested next',
      '- Add search to Projects  ',
      '* Show PR checks on the row',
      '',
      '3. Archive old tasks',
      '12. Group threads by project',
      '   ',
      'Plain line as a suggestion',
    ].join('\n')
    expect(suggestedNext(text)).toEqual([
      'Add search to Projects',
      'Show PR checks on the row',
      'Archive old tasks',
      'Group threads by project',
      'Plain line as a suggestion',
    ])
  })

  it('stops at the next heading', async () => {
    const suggestedNext = await helper()
    const text = '### Suggested next\n- Add search\n- Add filters\n## Notes\n- Not a suggestion'
    expect(suggestedNext(text)).toEqual(['Add search', 'Add filters'])
  })

  it('returns nothing without a Suggested next heading, or with an empty part', async () => {
    const suggestedNext = await helper()
    expect(suggestedNext('Shipped.\n- Add search')).toEqual([])
    expect(suggestedNext('Shipped.\n\n### Suggested next\n\n')).toEqual([])
  })
})

// ---- the thread -------------------------------------------------------------------------------

const ITEMS = ['Add search to Projects', 'Show PR checks on the row']
const NEXT = `### Suggested next\n- ${ITEMS[0]}\n- ${ITEMS[1]}`

const showDone = (summary: string) => {
  const task = makeTask('t1', {
    title: 'Order the replies',
    stage: 'done',
    doneAt: NOW - 5 * MINUTE,
    summary,
  })
  setB6(task, { comments: [sessionMsg('c1', 'done', summary, NOW - 5 * MINUTE)] })
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  return { user, writeText: stubClipboard() }
}
const copy = (item: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name: `Copy: ${item}` })

describe('B7-36 the suggestions in a Done message', () => {
  installClock()

  it.each([
    ['a plain summary', `Shipped the ordered replies.\n\n${NEXT}`],
    ['a summary brief', briefMessage('summary', { after: NEXT })],
  ])('%s: a list headed "You could start next" with a Copy button per item', (_name, summary) => {
    showDone(summary)
    const text = threadText()
    expect(text).toContain('You could start next')
    const buttons = ITEMS.map(copy)
    const list = buttons[0].closest('ul, ol, [role="list"]')
    expect(list).not.toBeNull()
    expect(within(list as HTMLElement).getAllByRole('button', { name: /^Copy: / })).toEqual(buttons)
    ITEMS.forEach((item) => {
      expect(text.indexOf(item, text.indexOf('You could start next'))).toBeGreaterThan(-1)
    })
  })

  it('Copy writes the item to the clipboard and shows Copied on that button', async () => {
    // Timers are fake too, so the two seconds of "Copied" can be stepped through.
    // installClock() already faked Date, and vitest ignores a second useFakeTimers call,
    // so reset first or setTimeout stays real.
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(NOW)
    const { writeText } = showDone(`Shipped.\n\n${NEXT}`)
    const button = copy(ITEMS[1])
    fireEvent.click(button)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(ITEMS[1])
    expect(button.textContent).toContain('Copied')
    expect(copy(ITEMS[0]).textContent).not.toContain('Copied')
    await act(() => vi.advanceTimersByTimeAsync(1_999))
    expect(button.textContent).toContain('Copied')
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(button.textContent).toContain('Copy')
    expect(button.textContent).not.toContain('Copied')
  })

  it('Copy logs copy_suggestion for the task and starts nothing', async () => {
    const { user } = showDone(`Shipped.\n\n${NEXT}`)
    await user.click(copy(ITEMS[0]))
    expect(userActions('copy_suggestion')).toHaveLength(1)
    expect(userActions('copy_suggestion')[0][1]).toEqual(
      expect.objectContaining({ action: 'copy_suggestion', target: 't1' })
    )
    const { request_id } = userActions('copy_suggestion')[0][1] as { request_id?: unknown }
    expect(typeof request_id).toBe('string')
    expect(request_id).not.toBe('')
    expect(writeCount()).toBe(0)
    expect(b3Actions.sendReply).not.toHaveBeenCalled()
    expect(b5Actions.createTask).not.toHaveBeenCalled()
    expect(b6Actions.reopenTask).not.toHaveBeenCalled()
    expect(where()).toBe('/t/t1')
  })
})

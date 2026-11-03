// @vitest-environment jsdom
// web-threads shared criterion 28, the reply half (owned by B3): offline, a reply shows at once
// with one tick and stays while the write is queued; when the network returns the snapshot
// carries it and the ticks advance; a permanently failed write removes the message, puts the
// text back, shows an inline error and logs api_call_failed with the Firestore code.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { MINUTE, NOW, installClock, logSpy, makeTask } from './fixtures/web-threads-b2.tsx'
import {
  b3Actions,
  composer,
  deniedWrite,
  jamesMsg,
  occurrences,
  pendingWrite,
  pushThread,
  renderThread,
  sendButton,
  sessionMsg,
  setThread,
  textAfter,
  threadText,
} from './fixtures/web-threads-b3.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const task = makeTask('t1', { title: 'Build the cache', stage: 'build' })
const history = [sessionMsg('c1', 'info', 'Started on the cache', NOW - 30 * MINUTE)]
const BODY = 'Use Redis for this'
const ERROR = /Couldn.t send\. Try again\./

async function reply(write: () => Promise<void>) {
  setThread(task, { comments: history })
  b3Actions.sendReply.mockImplementation(write)
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  await user.click(composer())
  await user.keyboard(BODY)
  await user.click(sendButton())
  return user
}
const sentId = () => b3Actions.sendReply.mock.calls[0][1].id

describe('B3-28 a reply while offline', () => {
  installClock()

  it('shows at once with one tick and stays while the write is queued', async () => {
    await reply(pendingWrite)
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(1)
    expect((composer() as HTMLTextAreaElement).value).toBe('')
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toMatch(/\bsent\b/)
    expect(screen.queryByRole('alert')).toBeNull()
    // Unrelated snapshots arrive (a session message); the queued reply stays, still one tick.
    pushThread({
      comments: [...history, sessionMsg('c2', 'info', 'Still going', NOW - MINUTE)],
    })
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toMatch(/\bsent\b/)
  })

  it('when the network returns, the snapshot carries it once and the ticks advance', async () => {
    await reply(pendingWrite)
    const echo = jamesMsg(sentId(), BODY, NOW)
    pushThread({ comments: [...history, echo] })
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toMatch(/\bsent\b/)
    pushThread({ comments: [...history, { ...echo, deliveredAt: NOW + 1 }] })
    expect(occurrences(BODY)).toBe(1)
    expect(textAfter(BODY)).toContain('received')
    pushThread({
      comments: [...history, { ...echo, deliveredAt: NOW + 1, workingAt: NOW + 2 }],
    })
    expect(textAfter(BODY)).toContain('working on it')
  })
})

describe('B3-28 a reply whose write fails for good', () => {
  installClock()

  it('removes the message, puts the text back and shows an inline error', async () => {
    await reply(deniedWrite)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(ERROR)
    expect(threadText()).not.toContain(BODY)
    expect((composer() as HTMLTextAreaElement).value).toBe(BODY)
  })

  it('logs api_call_failed with the Firestore code under the reply request id', async () => {
    await reply(deniedWrite)
    await screen.findByRole('alert')
    const failed = logSpy.error.mock.calls.filter((call) => call[0] === 'api_call_failed')
    expect(failed).toHaveLength(1)
    const context = failed[0][2] as Record<string, unknown>
    expect(context).toEqual(
      expect.objectContaining({
        feature: 'web-threads',
        action: 'reply',
        target: 'firestore',
        status: 'permission-denied',
      })
    )
    const tapped = logSpy.event.mock.calls.find(
      (call) => call[0] === 'user_action' && (call[1] as { action?: string }).action === 'reply'
    )
    expect(tapped).toBeTruthy()
    const requestId = (tapped?.[1] as { request_id?: unknown }).request_id
    expect(typeof requestId).toBe('string')
    expect(context.request_id).toBe(requestId)
  })

  it('the restored text can be sent again', async () => {
    const user = await reply(deniedWrite)
    await screen.findByRole('alert')
    b3Actions.sendReply.mockImplementation(pendingWrite)
    await user.click(sendButton())
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(2)
    expect(b3Actions.sendReply.mock.calls[1][1].body.trim()).toBe(BODY)
    expect(occurrences(BODY)).toBe(1)
  })
})

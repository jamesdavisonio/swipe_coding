// @vitest-environment jsdom
// web-threads B4, criterion 20: any decision sheet, while open, traps focus; Escape and the Close
// button dismiss it without side effects (no write, no decision logged) and the control that
// opened it regains focus. The real sheet is opened from the thread view and from Threads. The
// sheet also closes itself when the task no longer has the need it was opened for.
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { Task } from '../packages/shared/src/index.ts'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { MINUTE, NOW, installClock, logSpy, renderAt } from './fixtures/web-threads-b2.tsx'
import { b3Actions, renderThread, sessionMsg, thread } from './fixtures/web-threads-b3.tsx'
import {
  afterDeployTask,
  prTask,
  questionTask,
  renderSheet,
  setSheetTask,
  specTask,
  writeCount,
} from './fixtures/web-threads-b4.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b4.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const SPEC_TITLE = 'Spec v3 — Add search'
const sheet = () => screen.queryByRole('dialog')

// The spec thread, opened on its message's Read more (the sheet in mode read).
async function openFromThread(task: Task = specTask()) {
  setSheetTask(task)
  thread.comments.data = [sessionMsg('c1', 'spec', 'Here is the spec', NOW - 10 * MINUTE)]
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  const trigger = screen.getAllByRole('button', { name: 'Read more' })[0]
  await user.click(trigger)
  await screen.findByRole('dialog', { name: SPEC_TITLE })
  return { user, trigger }
}

// Threads with the after-deploy task, opened on its quick reply "Open the 2 steps".
async function openFromThreads() {
  setSheetTask(afterDeployTask())
  renderAt('/', <Threads />)
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Open the 2 steps' })
  await user.click(trigger)
  await screen.findByRole('dialog', { name: 'Deployed. Your steps:' })
  return { user, trigger }
}

// Nothing was decided: no write, no reply, no decision logged.
function expectNoSideEffects() {
  expect(writeCount()).toBe(0)
  expect(b3Actions.sendReply).not.toHaveBeenCalled()
  const decisions = logSpy.event.mock.calls.filter(
    (call) =>
      call[0] === 'user_action' &&
      ['approve_spec', 'request_change', 'answer', 'merged', 'tick_step', 'untick_step'].includes(
        String((call[1] as { action?: string }).action)
      )
  )
  expect(decisions).toEqual([])
}

async function expectTrapped(user: UserEvent, shift = false) {
  const dialog = screen.getByRole('dialog')
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
  for (let i = 0; i < 12; i++) {
    await user.tab({ shift })
    expect(dialog.contains(document.activeElement)).toBe(true)
  }
}

describe('B4-20 focus while a sheet is open', () => {
  installClock()

  it('keeps Tab inside the spec sheet', async () => {
    const { user } = await openFromThread()
    expect(screen.getByRole('button', { name: 'Approve v3' })).toBeTruthy()
    await expectTrapped(user)
  })

  it('keeps Shift+Tab inside the after-deploy sheet', async () => {
    const { user } = await openFromThreads()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await expectTrapped(user, true)
  })
})

describe('B4-20 dismissing a sheet', () => {
  installClock()

  it('Escape closes the spec sheet, writes nothing and focuses Read more again', async () => {
    const { user, trigger } = await openFromThread()
    expect(screen.getByRole('button', { name: 'Approve v3' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Close closes the spec sheet, writes nothing and focuses Read more again', async () => {
    const { user, trigger } = await openFromThread()
    expect(screen.getByRole('button', { name: 'Approve v3' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Escape with a change typed sends nothing', async () => {
    const { user, trigger } = await openFromThread()
    await user.click(screen.getByRole('button', { name: 'Changes…' }))
    await user.click(screen.getByRole('textbox', { name: 'What should change?' }))
    await user.keyboard('Search comments too')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Close on the after-deploy sheet ticks nothing and focuses Open the 2 steps again', async () => {
    const { user, trigger } = await openFromThreads()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Escape on the after-deploy sheet ticks nothing and focuses Open the 2 steps again', async () => {
    const { user, trigger } = await openFromThreads()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(sheet()).toBeNull())
    expectNoSideEffects()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('B4-20 the sheet closes itself when its need is gone', () => {
  installClock()

  it.each([
    ['spec', specTask(), specTask({ stage: 'build', needs: null })],
    ['question', questionTask(), questionTask({ needs: null })],
    ['pr', prTask(), prTask({ stage: 'merged', needs: null })],
    ['spec → question', specTask(), specTask({ needs: { kind: 'question', question: 'Why?' } })],
  ])('the %s sheet calls onClose once the task has moved on', async (_name, before, after) => {
    const { onClose, rerender } = renderSheet(DecisionSheet, before)
    expect(onClose).not.toHaveBeenCalled()
    rerender(after)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeCount()).toBe(0)
  })
})

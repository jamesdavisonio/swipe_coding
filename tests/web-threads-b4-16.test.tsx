// @vitest-environment jsdom
// web-threads B4, criterion 16: the spec decision sheet. Read more shows the spec (goal, points,
// out of scope, touches, version) with Approve v<N> and Changes…; Approve calls approveSpec once
// and closes when it resolves; a change request needs text, calls requestChange once with it and
// closes when it resolves. A failed write keeps the sheet open with an inline error (typed text
// kept) and logs api_call_failed. What each write stores is tested in the emulator
// (tests/emulator/web-threads-b4-16.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import { installClock } from './fixtures/web-threads-b2.tsx'
import { deniedWrite, pendingWrite } from './fixtures/web-threads-b3.tsx'
import {
  SAVE_ERROR,
  actions,
  b4Actions,
  dialog,
  failures,
  inDialog,
  renderSheet,
  sheetText,
  specTask,
  tapRequestId,
  userActions,
  writeCount,
} from './fixtures/web-threads-b4.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b4.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const task = specTask()
const TITLE = 'Spec v3 — Add search'
const CHANGE = 'Search comments too'
const open = (mode: 'read' | 'change' = 'read', t = task) => renderSheet(DecisionSheet, t, mode)

const approveButton = () => inDialog().getByRole('button', { name: 'Approve v3' })
const changesButton = () => inDialog().getByRole('button', { name: 'Changes…' })
const changeBox = () =>
  inDialog().getByRole<HTMLTextAreaElement>('textbox', { name: 'What should change?' })
const sendButton = () =>
  inDialog().getByRole<HTMLButtonElement>('button', { name: 'Send to session' })

describe('B4-16 the spec sheet shows the spec', () => {
  installClock()

  it('is a dialog named "Spec v<N> — <title>"', () => {
    open()
    expect(screen.getByRole('dialog', { name: TITLE })).toBeTruthy()
  })

  it('shows the goal, every point, out of scope and touches', () => {
    open()
    const text = sheetText()
    expect(text).toContain('Find any task by its title')
    expect(text).toContain('A search box above the list')
    expect(text).toContain('Matches as you type')
    expect(text).toMatch(/Out of scope.*Searching comments/)
    expect(text).toMatch(/Touches.*Threads screen/)
  })

  it('offers Approve v<N> and Changes…', () => {
    open()
    expect(approveButton()).toBeTruthy()
    expect(changesButton()).toBeTruthy()
    expect(inDialog().queryByRole('textbox', { name: 'What should change?' })).toBeNull()
  })

  it('says the spec is not attached yet when the task has none', () => {
    open('read', specTask({ spec: null }))
    expect(sheetText()).toContain("The session hasn't attached the spec yet.")
  })
})

describe('B4-16 Approve', () => {
  installClock()

  it('calls approveSpec once with the task and closes when it resolves', async () => {
    const { onClose, user } = open()
    await user.click(approveButton())
    expect(actions.approveSpec).toHaveBeenCalledTimes(1)
    expect(actions.approveSpec.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 't1' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeCount()).toBe(1)
  })

  it('logs user_action approve_spec with the task id', async () => {
    const { user } = open()
    await user.click(approveButton())
    expect(userActions('approve_spec')).toHaveLength(1)
    expect(userActions('approve_spec')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', action: 'approve_spec', target: 't1' })
    )
  })

  it('is disabled while the write is pending, so a second tap writes nothing', async () => {
    const { onClose, user } = open()
    actions.approveSpec.mockImplementation(pendingWrite)
    await user.click(approveButton())
    expect((approveButton() as HTMLButtonElement).disabled).toBe(true)
    await user.click(approveButton())
    expect(actions.approveSpec).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog()).toBeTruthy()
  })

  it('stays open with an inline error and logs api_call_failed when the write fails', async () => {
    const { onClose, user } = open()
    actions.approveSpec.mockImplementation(deniedWrite)
    await user.click(approveButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(SAVE_ERROR)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: TITLE })).toBeTruthy()
    expect(failures('approve_spec')).toHaveLength(1)
    const context = failures('approve_spec')[0][2] as Record<string, unknown>
    expect(context).toEqual(
      expect.objectContaining({
        feature: 'web-threads',
        target: 'firestore',
        status: 'permission-denied',
      })
    )
    expect(context.request_id).toBe(tapRequestId('approve_spec'))
  })
})

describe('B4-16 Request a change', () => {
  installClock()

  it('Changes… shows the change box with Send to session disabled until there is text', async () => {
    const { user } = open()
    await user.click(changesButton())
    expect(changeBox().value).toBe('')
    expect(sendButton().disabled).toBe(true)
    await user.click(changeBox())
    await user.keyboard('   ')
    expect(sendButton().disabled).toBe(true)
    await user.keyboard(CHANGE)
    expect(sendButton().disabled).toBe(false)
  })

  it('opens straight on the change box in mode change', () => {
    open('change')
    expect(changeBox()).toBeTruthy()
    expect(sendButton().disabled).toBe(true)
  })

  it('sends the text with requestChange once and closes when it resolves', async () => {
    const { onClose, user } = open('change')
    await user.click(changeBox())
    await user.keyboard(CHANGE)
    await user.click(sendButton())
    expect(b4Actions.requestChange).toHaveBeenCalledTimes(1)
    const [sentTask, text] = b4Actions.requestChange.mock.calls[0]
    expect(sentTask).toEqual(expect.objectContaining({ id: 't1' }))
    expect(text.trim()).toBe(CHANGE)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(actions.approveSpec).not.toHaveBeenCalled()
    expect(userActions('request_change')).toHaveLength(1)
    expect(userActions('request_change')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', target: 't1' })
    )
  })

  it('never sends whitespace-only text', async () => {
    const { onClose, user } = open('change')
    await user.click(changeBox())
    await user.keyboard('   ')
    await user.click(sendButton())
    expect(b4Actions.requestChange).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Cancel goes back to the spec without writing', async () => {
    const { onClose, user } = open()
    await user.click(changesButton())
    await user.click(changeBox())
    await user.keyboard(CHANGE)
    await user.click(inDialog().getByRole('button', { name: 'Cancel' }))
    expect(inDialog().queryByRole('textbox', { name: 'What should change?' })).toBeNull()
    expect(approveButton()).toBeTruthy()
    expect(sheetText()).toContain('Find any task by its title')
    expect(writeCount()).toBe(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('is disabled while the write is pending, so a second tap writes nothing', async () => {
    const { user } = open('change')
    b4Actions.requestChange.mockImplementation(pendingWrite)
    await user.click(changeBox())
    await user.keyboard(CHANGE)
    await user.click(sendButton())
    expect(sendButton().disabled).toBe(true)
    await user.click(sendButton())
    expect(b4Actions.requestChange).toHaveBeenCalledTimes(1)
  })

  it('keeps the text and shows an inline error when the write fails', async () => {
    const { onClose, user } = open('change')
    b4Actions.requestChange.mockImplementation(deniedWrite)
    await user.click(changeBox())
    await user.keyboard(CHANGE)
    await user.click(sendButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(SAVE_ERROR)
    expect(changeBox().value).toBe(CHANGE)
    expect(onClose).not.toHaveBeenCalled()
    const failed = failures('request_change')
    expect(failed).toHaveLength(1)
    expect(failed[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect((failed[0][2] as { request_id?: unknown }).request_id).toBe(
      tapRequestId('request_change')
    )
  })
})

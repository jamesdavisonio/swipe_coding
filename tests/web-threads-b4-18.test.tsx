// @vitest-environment jsdom
// web-threads B4, criterion 18: the PR sheet. Read more shows the session's summary, an Open PR
// link (new tab, web links only) and Merged it; Merged it calls markMerged once and closes when
// it resolves; a failed write keeps the sheet open with an inline error. What it stores is tested
// in the emulator (tests/emulator/web-threads-b4-18.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import { installClock } from './fixtures/web-threads-b2.tsx'
import { deniedWrite, pendingWrite } from './fixtures/web-threads-b3.tsx'
import {
  SAVE_ERROR,
  actions,
  failures,
  inDialog,
  prTask,
  renderSheet,
  sheetText,
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

const URL = 'https://github.com/nullnoise/kanban/pull/42'
const open = (t = prTask()) => renderSheet(DecisionSheet, t, 'read')
const mergedButton = () => inDialog().getByRole<HTMLButtonElement>('button', { name: 'Merged it' })

describe('B4-18 the PR sheet shows the PR', () => {
  installClock()

  it('is a dialog named "PR #<n> is ready to merge" showing the summary', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'PR #42 is ready to merge' })).toBeTruthy()
    expect(sheetText()).toContain('Header no longer overlaps the list on small phones.')
    expect(mergedButton()).toBeTruthy()
  })

  it('links to the PR in a new tab', () => {
    open()
    const link = inDialog().getByRole('link', { name: 'Open PR #42 in GitHub' })
    expect(link.getAttribute('href')).toBe(URL)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel') ?? '').toContain('noopener')
  })

  it('is named "PR is ready to merge" and has no link when the task has no PR', () => {
    open(prTask({ pr: null }))
    expect(screen.getByRole('dialog', { name: 'PR is ready to merge' })).toBeTruthy()
    expect(inDialog().queryAllByRole('link')).toEqual([])
    expect(mergedButton()).toBeTruthy()
  })

  it('never links to a URL that is not http or https', () => {
    open(prTask({ pr: { number: 42, url: 'javascript:alert(1)' } }))
    expect(screen.getByRole('dialog', { name: 'PR #42 is ready to merge' })).toBeTruthy()
    expect(inDialog().queryAllByRole('link')).toEqual([])
    expect(mergedButton()).toBeTruthy()
  })
})

describe('B4-18 Merged it', () => {
  installClock()

  it('calls markMerged once with the task and closes when it resolves', async () => {
    const { onClose, user } = open()
    await user.click(mergedButton())
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
    expect(actions.markMerged.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 't1' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeCount()).toBe(1)
    expect(userActions('merged')).toHaveLength(1)
    expect(userActions('merged')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', action: 'merged', target: 't1' })
    )
  })

  it('is disabled while the write is pending, so a second tap writes nothing', async () => {
    const { onClose, user } = open()
    actions.markMerged.mockImplementation(pendingWrite)
    await user.click(mergedButton())
    expect(mergedButton().disabled).toBe(true)
    await user.click(mergedButton())
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open with an inline error and logs api_call_failed when the write fails', async () => {
    const { onClose, user } = open()
    actions.markMerged.mockImplementation(deniedWrite)
    await user.click(mergedButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(SAVE_ERROR)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'PR #42 is ready to merge' })).toBeTruthy()
    const failed = failures('merged')
    expect(failed).toHaveLength(1)
    expect(failed[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect((failed[0][2] as { request_id?: unknown }).request_id).toBe(tapRequestId('merged'))
  })
})

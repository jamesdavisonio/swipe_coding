// @vitest-environment jsdom
// web-threads shared criterion 28, the tick half (owned by B4): offline, ticking a step shows the
// new checkbox state at once and keeps it while the write is queued (also across snapshots that
// do not carry it yet); when the snapshot carries it, it stays; a permanently failed write puts
// the checkbox back, shows an inline error and logs api_call_failed with the Firestore code.
// That tickStep is a batch Firestore queues offline is tested in the emulator
// (tests/emulator/web-threads-b4-28.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import { installClock } from './fixtures/web-threads-b2.tsx'
import { deniedWrite, pendingWrite } from './fixtures/web-threads-b3.tsx'
import {
  SAVE_ERROR,
  STEPS,
  afterDeployTask,
  b4Actions,
  failures,
  inDialog,
  renderSheet,
  tapRequestId,
} from './fixtures/web-threads-b4.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b4.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const step = (i: number) => inDialog().getByRole<HTMLInputElement>('checkbox', { name: STEPS[i] })

async function tick(write: () => Promise<void>, task = afterDeployTask(), index = 0) {
  const sheet = renderSheet(DecisionSheet, task)
  b4Actions.tickStep.mockImplementation(write)
  await sheet.user.click(step(index))
  return sheet
}

describe('B4-28 a tick while offline', () => {
  installClock()

  it('shows the tick at once and keeps it while the write is queued', async () => {
    await tick(pendingWrite)
    expect(b4Actions.tickStep).toHaveBeenCalledTimes(1)
    expect(step(0).checked).toBe(true)
    expect(step(1).checked).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the tick across a snapshot that does not carry it yet', async () => {
    const { rerender } = await tick(pendingWrite)
    rerender(afterDeployTask({ summary: 'Deployed at noon' }))
    expect(step(0).checked).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the untick while the write is queued', async () => {
    await tick(pendingWrite, afterDeployTask({ afterDone: [true, false] }))
    expect(step(0).checked).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('stays ticked once the snapshot carries the tick', async () => {
    const { rerender } = await tick(pendingWrite)
    rerender(afterDeployTask({ afterDone: [true, false] }))
    expect(step(0).checked).toBe(true)
    expect(step(1).checked).toBe(false)
  })
})

describe('B4-28 a tick whose write fails for good', () => {
  installClock()

  it('puts the checkbox back and shows an inline error', async () => {
    const { onClose } = await tick(deniedWrite)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(SAVE_ERROR)
    expect(step(0).checked).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('puts an untick back too', async () => {
    await tick(deniedWrite, afterDeployTask({ afterDone: [true, false] }))
    await screen.findByRole('alert')
    expect(step(0).checked).toBe(true)
  })

  it('logs api_call_failed with the Firestore code under the tick request id', async () => {
    await tick(deniedWrite)
    await screen.findByRole('alert')
    const failed = failures('tick_step')
    expect(failed).toHaveLength(1)
    const context = failed[0][2] as Record<string, unknown>
    expect(context).toEqual(
      expect.objectContaining({
        feature: 'web-threads',
        target: 'firestore',
        status: 'permission-denied',
      })
    )
    expect(context.request_id).toBe(tapRequestId('tick_step'))
  })
})

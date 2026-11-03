// @vitest-environment jsdom
// web-threads B4, criterion 19: the after-deploy sheet. Each step is a checkbox row labelled by
// the step and checked from afterDone; ticking or unticking calls tickStep(task, index) once and
// logs tick_step / untick_step; the tick that completes every step logs milestone_reached
// task_done once it resolves; when the task no longer needs the steps the sheet closes itself.
// What a tick stores (history, done, doneAt, the message) is tested in the emulator
// (tests/emulator/web-threads-b4-19.test.ts). The 44 px row height is CSS, checked at review;
// here the whole row (the step's text) is the tap target.
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import { DAY, NOW, installClock, logSpy } from './fixtures/web-threads-b2.tsx'
import { deniedWrite, pendingWrite } from './fixtures/web-threads-b3.tsx'
import {
  STEPS,
  afterDeployTask,
  b4Actions,
  inDialog,
  renderSheet,
  sheetText,
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

const open = (t = afterDeployTask()) => renderSheet(DecisionSheet, t, 'read')
const step = (i: number) => inDialog().getByRole<HTMLInputElement>('checkbox', { name: STEPS[i] })
// Fidelity round 1 decision (B4): milestone_reached is logged with log.event('milestone_reached',
// { feature, milestone: 'task_done', target }), only after the completing tick's write resolves.
const milestones = () =>
  logSpy.event.mock.calls.filter(
    (call) =>
      call[0] === 'milestone_reached' &&
      (call[1] as { milestone?: string }).milestone === 'task_done'
  )

describe('B4-19 the after-deploy sheet shows the steps', () => {
  installClock()

  it('is a dialog named "Deployed. Your steps:" with the closing note', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Deployed. Your steps:' })).toBeTruthy()
    expect(sheetText()).toContain('The task closes itself when every step is ticked.')
  })

  it('has one checkbox per step, labelled by the step and checked from afterDone', () => {
    open(afterDeployTask({ afterDone: [true, false] }))
    expect(inDialog().getAllByRole('checkbox')).toHaveLength(2)
    expect(step(0).checked).toBe(true)
    expect(step(1).checked).toBe(false)
  })

  it('follows afterDone from later snapshots without a tap (ticks from another device)', () => {
    const { rerender } = open(afterDeployTask({ afterDone: [false, false] }))
    expect(step(0).checked).toBe(false)
    rerender(afterDeployTask({ afterDone: [true, false] }))
    expect(step(0).checked).toBe(true)
    expect(step(1).checked).toBe(false)
    rerender(afterDeployTask({ afterDone: [false, false] }))
    expect(step(0).checked).toBe(false)
    expect(b4Actions.tickStep).not.toHaveBeenCalled()
  })
})

describe('B4-19 ticking a step', () => {
  installClock()

  it('ticking calls tickStep once with the task and the step index', async () => {
    const { user } = open()
    await user.click(step(1))
    expect(b4Actions.tickStep).toHaveBeenCalledTimes(1)
    const [sentTask, index] = b4Actions.tickStep.mock.calls[0]
    expect(sentTask).toEqual(expect.objectContaining({ id: 't1' }))
    expect(index).toBe(1)
    expect(step(1).checked).toBe(true)
    expect(writeCount()).toBe(1)
  })

  it('tapping the step text ticks it too (the whole row is the target)', async () => {
    const { user } = open()
    await user.click(inDialog().getByText(STEPS[0]))
    expect(b4Actions.tickStep).toHaveBeenCalledTimes(1)
    expect(b4Actions.tickStep.mock.calls[0][1]).toBe(0)
    expect(step(0).checked).toBe(true)
  })

  it('logs user_action tick_step with the task id', async () => {
    const { user } = open()
    await user.click(step(0))
    expect(userActions('tick_step')).toHaveLength(1)
    expect(userActions('tick_step')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', action: 'tick_step', target: 't1' })
    )
    expect(userActions('untick_step')).toHaveLength(0)
  })

  it('unticking calls tickStep for that step and logs untick_step', async () => {
    const { user } = open(afterDeployTask({ afterDone: [true, false] }))
    await user.click(step(0))
    expect(b4Actions.tickStep).toHaveBeenCalledTimes(1)
    expect(b4Actions.tickStep.mock.calls[0][1]).toBe(0)
    expect(step(0).checked).toBe(false)
    expect(userActions('untick_step')).toHaveLength(1)
    expect(userActions('untick_step')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', target: 't1' })
    )
    expect(userActions('tick_step')).toHaveLength(0)
  })

  it('a tick that leaves a step open reaches no milestone', async () => {
    const { user } = open()
    await user.click(step(0))
    await waitFor(() => expect(b4Actions.tickStep).toHaveBeenCalledTimes(1))
    expect(milestones()).toHaveLength(0)
  })

  it('the tick that completes every step logs milestone_reached task_done once it resolves', async () => {
    const { user } = open(afterDeployTask({ afterDone: [true, false] }))
    await user.click(step(1))
    await waitFor(() => expect(milestones()).toHaveLength(1))
    expect(milestones()[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', milestone: 'task_done', target: 't1' })
    )
  })

  it('logs no milestone while the completing tick is still pending', async () => {
    const { user } = open(afterDeployTask({ afterDone: [true, false] }))
    b4Actions.tickStep.mockImplementation(pendingWrite)
    await user.click(step(1))
    expect(b4Actions.tickStep).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(step(1).checked).toBe(true))
    expect(milestones()).toHaveLength(0)
  })

  it('logs no milestone when the completing tick fails', async () => {
    const { user } = open(afterDeployTask({ afterDone: [true, false] }))
    b4Actions.tickStep.mockImplementation(deniedWrite)
    await user.click(step(1))
    await screen.findByRole('alert')
    expect(milestones()).toHaveLength(0)
  })

  it('closes itself once the task is done and no longer needs the steps', async () => {
    const { onClose, rerender } = open(afterDeployTask({ afterDone: [true, false] }))
    expect(step(1)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    rerender(afterDeployTask({ stage: 'done', needs: null, afterDone: [true, true], doneAt: NOW }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('stays open while the task still needs the steps (a later snapshot, same need)', () => {
    const { onClose, rerender } = open()
    rerender(afterDeployTask({ summary: 'Deployed at noon', updatedAt: NOW - DAY + 1 }))
    expect(onClose).not.toHaveBeenCalled()
    expect(step(0)).toBeTruthy()
  })
})

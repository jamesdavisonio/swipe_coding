// @vitest-environment jsdom
// web-threads shared criterion 30 on the decision sheet: in every kind of sheet each control is
// reachable with Tab and has an accessible name, and every decision can be made from the
// keyboard alone. (The visible focus ring is CSS that jsdom cannot render; it is checked at
// review.)
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { Task } from '../packages/shared/src/index.ts'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import { installClock } from './fixtures/web-threads-b2.tsx'
import {
  STEPS,
  actions,
  afterDeployTask,
  b4Actions,
  prTask,
  questionTask,
  renderSheet,
  specTask,
} from './fixtures/web-threads-b4.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b4.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const SHEETS: [string, Task, string][] = [
  ['spec', specTask(), 'Spec v3 — Add search'],
  ['question', questionTask(), 'Which font should we use?'],
  ['pr', prTask(), 'PR #42 is ready to merge'],
  ['after_deploy', afterDeployTask(), 'Deployed. Your steps:'],
]

const controlsIn = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]'
    )
  ).filter((el) => el.getAttribute('tabindex') !== '-1')

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let i = 0; i < 30 && document.activeElement !== target; i++) await user.tab()
  expect(document.activeElement).toBe(target)
}

describe('B4-30 keyboard and names in each sheet', () => {
  installClock()

  it.each(SHEETS)('the %s sheet: every control has a name', (_kind, task, title) => {
    renderSheet(DecisionSheet, task)
    const sheet = screen.getByRole('dialog', { name: title })
    const inSheet = within(sheet)
    expect(inSheet.queryAllByRole('button', { name: '' })).toEqual([])
    expect(inSheet.queryAllByRole('link', { name: '' })).toEqual([])
    expect(inSheet.queryAllByRole('textbox', { name: '' })).toEqual([])
    expect(inSheet.queryAllByRole('checkbox', { name: '' })).toEqual([])
    expect(inSheet.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it.each(SHEETS)('the %s sheet: Tab reaches every control', async (_kind, task, title) => {
    const { user } = renderSheet(DecisionSheet, task)
    const sheet = screen.getByRole('dialog', { name: title })
    const all = controlsIn(sheet)
    // Close plus at least one decision control.
    expect(all.length).toBeGreaterThanOrEqual(2)
    // The sheet takes focus on open; Tab then cycles through it (focus is trapped).
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true))
    const reached = new Set<Element>([document.activeElement as Element])
    for (let i = 0; i < 30; i++) {
      await user.tab()
      const el = document.activeElement
      if (!el || reached.has(el)) break
      reached.add(el)
    }
    expect(all.filter((el) => !reached.has(el)).map((el) => el.outerHTML)).toEqual([])
  })
})

describe('B4-30 deciding with the keyboard alone', () => {
  installClock()

  it('approves the spec with Enter', async () => {
    const { user } = renderSheet(DecisionSheet, specTask())
    await tabTo(user, screen.getByRole('button', { name: 'Approve v3' }))
    await user.keyboard('{Enter}')
    expect(actions.approveSpec).toHaveBeenCalledTimes(1)
  })

  it('writes and sends a change request from the keyboard', async () => {
    const { user } = renderSheet(DecisionSheet, specTask())
    await tabTo(user, screen.getByRole('button', { name: 'Changes…' }))
    await user.keyboard('{Enter}')
    const box = screen.getByRole('textbox', { name: 'What should change?' })
    await tabTo(user, box)
    await user.keyboard('Search comments too')
    await tabTo(user, screen.getByRole('button', { name: 'Send to session' }))
    await user.keyboard('{Enter}')
    expect(b4Actions.requestChange).toHaveBeenCalledTimes(1)
    expect(b4Actions.requestChange.mock.calls[0][1].trim()).toBe('Search comments too')
  })

  it('picks an option with Space', async () => {
    const { user } = renderSheet(DecisionSheet, questionTask())
    await tabTo(user, screen.getByRole('button', { name: 'B · Atkinson' }))
    await user.keyboard(' ')
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(actions.answerQuestion.mock.calls[0][1]).toEqual({ key: 'B', label: 'Atkinson' })
  })

  it('confirms the merge with Enter', async () => {
    const { user } = renderSheet(DecisionSheet, prTask())
    await tabTo(user, screen.getByRole('button', { name: 'Merged it' }))
    await user.keyboard('{Enter}')
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
  })

  it('ticks a step with Space', async () => {
    const { user } = renderSheet(DecisionSheet, afterDeployTask())
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: STEPS[1] })
    await tabTo(user, box)
    await user.keyboard(' ')
    expect(b4Actions.tickStep).toHaveBeenCalledTimes(1)
    expect(b4Actions.tickStep.mock.calls[0][1]).toBe(1)
    await waitFor(() => expect(box.checked).toBe(true))
  })
})

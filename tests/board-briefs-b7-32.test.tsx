// @vitest-environment jsdom
// board-briefs B7, criterion 32: a task waiting on a spec decision whose session posted a spec
// brief (sessions post it as the note when they set spec to awaiting_approval, so it arrives as a
// session message). Read more opens the spec sheet with the latest such brief first, then a
// "Full spec" toggle (aria-expanded) that reveals the B4 spec content below it, or that message's
// text around the brief when the task has no spec. Approve and Changes behave as in B4.
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Comment, Task } from '../packages/shared/src/index.ts'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { MINUTE, NOW, installClock, isBefore } from './fixtures/web-threads-b2.tsx'
import { readMoreButtons, renderThread, sessionMsg } from './fixtures/web-threads-b3.tsx'
import { actions, specTask } from './fixtures/web-threads-b4.tsx'
import { setB6 } from './fixtures/web-threads-b6.tsx'
import {
  PARTS,
  allUserActions,
  briefMessage,
  expectCard,
  partsWith,
  posIn,
  shownIn,
} from './fixtures/board-briefs-b7.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const GOAL = 'Find any task by its title'
const POINT = 'Matches as you type'
const OLD = partsWith('Earlier draft:')

// An older spec brief, the latest one, then a plain progress note.
const briefs = (): Comment[] => [
  sessionMsg('c1', 'info', briefMessage('spec', { parts: OLD }), NOW - 50 * MINUTE),
  sessionMsg(
    'c2',
    'info',
    briefMessage('spec', { before: 'Spec v3 is ready.' }),
    NOW - 20 * MINUTE
  ),
  sessionMsg('c3', 'info', 'Waiting for your approval.', NOW - 10 * MINUTE),
]

async function openSheet(task: Task = specTask(), comments: Comment[] = briefs()) {
  setB6(task, { comments })
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  await user.click(readMoreButtons()[0])
  const sheet = screen.getByRole('dialog', {
    name: `Spec v${task.spec?.version ?? 1} — ${task.title}`,
  })
  return { user, sheet }
}
const fullSpec = (sheet: HTMLElement) =>
  within(sheet).getByRole<HTMLButtonElement>('button', { name: 'Full spec' })

describe('B7-32 the spec sheet leads with the spec brief', () => {
  installClock()

  it('shows the latest spec brief as a card, then a collapsed Full spec toggle', async () => {
    const { sheet } = await openSheet()
    const card = within(sheet).getByRole('heading', { name: 'Spec' })
    expectCard(sheet, PARTS.spec)
    expect(posIn(sheet, OLD.origin)).toBe(-1)
    const toggle = fullSpec(sheet)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(isBefore(card, toggle)).toBe(true)
    expect(shownIn(sheet, GOAL)).toBe(false)
    expect(shownIn(sheet, POINT)).toBe(false)
  })

  it('Full spec reveals the spec below it and collapses it again', async () => {
    const { user, sheet } = await openSheet()
    await user.click(fullSpec(sheet))
    expect(fullSpec(sheet).getAttribute('aria-expanded')).toBe('true')
    expect(shownIn(sheet, GOAL)).toBe(true)
    expect(shownIn(sheet, POINT)).toBe(true)
    expect(posIn(sheet, GOAL)).toBeGreaterThan(posIn(sheet, 'Full spec'))
    expect(posIn(sheet, GOAL)).toBeGreaterThan(posIn(sheet, PARTS.spec.agreeing))
    await user.click(fullSpec(sheet))
    expect(fullSpec(sheet).getAttribute('aria-expanded')).toBe('false')
    expect(shownIn(sheet, GOAL)).toBe(false)
  })

  it('with no spec attached, Full spec reveals the text around the brief in its message', async () => {
    const around = briefMessage('spec', {
      before: 'I wrote the spec for search.',
      after: '---\n\nGoal: find any task by its title, as you type.',
    })
    const { user, sheet } = await openSheet(specTask({ spec: null }), [
      sessionMsg('c1', 'info', around, NOW - 5 * MINUTE),
    ])
    expectCard(sheet, PARTS.spec)
    expect(shownIn(sheet, 'I wrote the spec for search.')).toBe(false)
    await user.click(fullSpec(sheet))
    expect(shownIn(sheet, 'I wrote the spec for search.')).toBe(true)
    expect(shownIn(sheet, 'Goal: find any task by its title, as you type.')).toBe(true)
  })

  it('Full spec is not logged', async () => {
    const { user, sheet } = await openSheet()
    const before = allUserActions().length
    await user.click(fullSpec(sheet))
    expect(allUserActions()).toHaveLength(before)
  })
})

describe('B7-32 Approve and Changes behave as in B4', () => {
  installClock()

  it('Approve v3 calls approveSpec once for the task', async () => {
    const { user, sheet } = await openSheet()
    expect(fullSpec(sheet)).toBeTruthy()
    await user.click(within(sheet).getByRole('button', { name: 'Approve v3' }))
    expect(actions.approveSpec).toHaveBeenCalledTimes(1)
    expect(actions.approveSpec.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 't1' }))
  })

  it('Changes… opens the change box', async () => {
    const { user, sheet } = await openSheet()
    expect(fullSpec(sheet)).toBeTruthy()
    await user.click(within(sheet).getByRole('button', { name: 'Changes…' }))
    expect(within(sheet).getByRole('textbox', { name: 'What should change?' })).toBeTruthy()
  })

  it('without a spec brief in the thread, the sheet shows the spec as before, with no toggle', async () => {
    const { sheet } = await openSheet(specTask(), [
      sessionMsg('c1', 'info', 'Spec v3 is ready.', NOW - 5 * MINUTE),
    ])
    expect(shownIn(sheet, GOAL)).toBe(true)
    expect(within(sheet).queryByRole('button', { name: 'Full spec' })).toBeNull()
  })
})

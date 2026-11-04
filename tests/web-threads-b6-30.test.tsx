// @vitest-environment jsdom
// web-threads B6, shared criterion 30 on the History and Reopen sheets: each opens from the
// keyboard, traps focus while open, names every control, and Escape or Close dismisses it
// without a write, returning focus to the control that opened it (as B4's criterion 20); reopening
// works from the keyboard alone; the Done tab's History and Reopen buttons are reachable with Tab
// and named. (The visible focus ring is CSS that jsdom cannot render; it is checked at review.)
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { LOG_CAP } from '../packages/shared/src/index.ts'
import Project from '../packages/web/src/pages/Project.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { DAY, NOW, installClock } from './fixtures/web-threads-b2.tsx'
import { renderThread } from './fixtures/web-threads-b3.tsx'
import { userActions } from './fixtures/web-threads-b4.tsx'
import { controls, renderB5, taskCard } from './fixtures/web-threads-b5.tsx'
import { REOPEN_LABEL, b6Actions, doneTask, lines, setB6 } from './fixtures/web-threads-b6.tsx'

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

const HISTORY = 'Decision history'
const REOPEN = 'Reopen task'

// A done task whose log is full, so its History sheet has Show earlier history and Reopen task.
const fullDone = () => doneTask({ log: lines(LOG_CAP) })

const controlsIn = (root: HTMLElement) => controls().filter((el) => root.contains(el))

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let i = 0; i < 40 && document.activeElement !== target; i++) await user.tab()
  expect(document.activeElement).toBe(target)
}

// Focus is in the sheet and Tab (or Shift+Tab) cycles through every control in it, never out.
async function expectTrappedAndReachable(user: UserEvent, sheet: HTMLElement, atLeast: number) {
  await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true))
  const all = controlsIn(sheet)
  expect(all.length).toBeGreaterThanOrEqual(atLeast)
  const reached = new Set<Element>([document.activeElement as Element])
  for (let i = 0; i < 2 * all.length + 2; i++) {
    await user.tab()
    expect(sheet.contains(document.activeElement)).toBe(true)
    reached.add(document.activeElement as Element)
  }
  expect(all.filter((el) => !reached.has(el)).map((el) => el.outerHTML)).toEqual([])
  await user.tab({ shift: true })
  expect(sheet.contains(document.activeElement)).toBe(true)
}

function expectNamedIn(sheet: HTMLElement) {
  const inSheet = within(sheet)
  for (const role of ['button', 'link', 'textbox', 'checkbox'])
    expect(inSheet.queryAllByRole(role, { name: '' })).toEqual([])
  expect(inSheet.getByRole('button', { name: 'Close' })).toBeTruthy()
}

// The done task's thread; `name` (Decision history or Reopen) is reached with Tab and pressed.
async function openFromThreadByKeyboard(name: string, sheetName: string) {
  setB6(fullDone())
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name })
  await tabTo(user, trigger)
  await user.keyboard('{Enter}')
  const sheet = await screen.findByRole('dialog', { name: sheetName })
  return { user, trigger, sheet }
}

// Two done tasks on the Done tab.
function openDoneTab() {
  const other = { ...doneTask({ title: 'Add search', doneAt: NOW - DAY }), id: 't2' }
  const task = fullDone()
  setB6(task, { tasks: [other, task] })
  renderB5('/p/p-kanban?tab=done', { '/p/:projectId': <Project /> })
  return userEvent.setup()
}

describe('B6-30 the History sheet from the keyboard', () => {
  installClock()

  it('opens from Decision history, names every control and keeps Tab inside', async () => {
    const { user, sheet } = await openFromThreadByKeyboard(HISTORY, HISTORY)
    expectNamedIn(sheet)
    expect(within(sheet).getByRole('button', { name: 'Show earlier history' })).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: REOPEN })).toBeTruthy()
    // Close, Show earlier history, Reopen task.
    await expectTrappedAndReachable(user, sheet, 3)
  })

  it('Escape closes it and focuses Decision history again', async () => {
    const { user, trigger, sheet } = await openFromThreadByKeyboard(HISTORY, HISTORY)
    expect(within(sheet).getByRole('button', { name: REOPEN })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(b6Actions.reopenTask).not.toHaveBeenCalled()
  })

  it('Close closes it and focuses Decision history again', async () => {
    const { user, trigger, sheet } = await openFromThreadByKeyboard(HISTORY, HISTORY)
    expect(within(sheet).getByRole('button', { name: REOPEN })).toBeTruthy()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it("opens from a Done card's History with Enter; Escape returns focus to it", async () => {
    const user = openDoneTab()
    const trigger = within(taskCard('t1')).getByRole('button', { name: /^History/ })
    await tabTo(user, trigger)
    await user.keyboard('{Enter}')
    const sheet = await screen.findByRole('dialog', { name: HISTORY })
    expect(within(sheet).getByRole('heading', { name: 'Ship the nav' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('B6-30 the Reopen sheet from the keyboard', () => {
  installClock()

  it('opens from Reopen, names every control and keeps Tab inside', async () => {
    const { user, sheet } = await openFromThreadByKeyboard('Reopen', REOPEN)
    expectNamedIn(sheet)
    expect(within(sheet).getByRole('textbox', { name: REOPEN_LABEL })).toBeTruthy()
    // Close, the note, Cancel (Reopen and send is disabled while the note is empty).
    await expectTrappedAndReachable(user, sheet, 3)
  })

  it('reopens with the keyboard alone', async () => {
    const { user, sheet } = await openFromThreadByKeyboard('Reopen', REOPEN)
    await tabTo(user, within(sheet).getByRole('textbox', { name: REOPEN_LABEL }))
    await user.keyboard('The nav is broken on phones')
    await tabTo(user, within(sheet).getByRole('button', { name: 'Reopen and send' }))
    await user.keyboard('{Enter}')
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(1)
    expect(b6Actions.reopenTask.mock.calls[0][1].trim()).toBe('The nav is broken on phones')
  })

  it('Escape with a note typed writes nothing and focuses Reopen again', async () => {
    const { user, trigger, sheet } = await openFromThreadByKeyboard('Reopen', REOPEN)
    await tabTo(user, within(sheet).getByRole('textbox', { name: REOPEN_LABEL }))
    await user.keyboard('The nav is broken on phones')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(b6Actions.reopenTask).not.toHaveBeenCalled()
    expect(userActions('reopen')).toHaveLength(0)
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it.each(['Cancel', 'Close'])(
    '%s on the sheet opened from the footer writes nothing and focuses Reopen again',
    async (dismiss) => {
      const { user, trigger, sheet } = await openFromThreadByKeyboard('Reopen', REOPEN)
      await tabTo(user, within(sheet).getByRole('textbox', { name: REOPEN_LABEL }))
      await user.keyboard('The nav is broken on phones')
      await user.click(within(sheet).getByRole('button', { name: dismiss }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(b6Actions.reopenTask).not.toHaveBeenCalled()
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    }
  )

  it.each(['Cancel', 'Close'])(
    "%s on the sheet opened from a Done card writes nothing and focuses the card's Reopen again",
    async (dismiss) => {
      const user = openDoneTab()
      const trigger = within(taskCard('t2')).getByRole('button', { name: /^Reopen/ })
      await tabTo(user, trigger)
      await user.keyboard('{Enter}')
      const sheet = await screen.findByRole('dialog', { name: REOPEN })
      await tabTo(user, within(sheet).getByRole('textbox', { name: REOPEN_LABEL }))
      await user.keyboard('The search is slow')
      await user.click(within(sheet).getByRole('button', { name: dismiss }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(b6Actions.reopenTask).not.toHaveBeenCalled()
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    }
  )

  it('reaches every Done card control with Tab, each named, and opens Reopen with Enter', async () => {
    const user = openDoneTab()
    const card = taskCard('t2')
    for (const name of [/^History/, /^Reopen/])
      expect(within(card).getByRole('button', { name })).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: '' })).toEqual([])
    const reached = new Set<Element>()
    for (let i = 0; i < 40; i++) {
      await user.tab()
      const el = document.activeElement
      if (!el || el === document.body || reached.has(el)) break
      reached.add(el)
    }
    expect(
      controls()
        .filter((el) => !reached.has(el))
        .map((el) => el.outerHTML)
    ).toEqual([])
    const reopen = within(card).getByRole('button', { name: /^Reopen/ })
    await tabTo(user, reopen)
    await user.keyboard('{Enter}')
    const sheet = await screen.findByRole('dialog', { name: REOPEN })
    expect(within(sheet).getByRole('heading', { name: 'Add search' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(reopen))
  })
})

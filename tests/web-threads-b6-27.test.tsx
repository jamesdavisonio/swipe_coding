// @vitest-environment jsdom
// web-threads B6, criterion 27: a reopened task is back in the lists however long ago it was
// done. Reopening sets doneAt to null and moves the stage back, so the task is not done: it shows
// on Threads and on its project's Live tab (and leaves the Done tab), whatever its old doneAt was.
// The flows reopen a task that finished long ago, from its thread and from the Done tab's older
// list, with the snapshot after reopenTask bringing the reopened task, and find it on Threads.
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { DONE_VISIBLE_MS, type Task } from '../packages/shared/src/index.ts'
import Project from '../packages/web/src/pages/Project.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  DAY,
  HOUR,
  NOW,
  installClock,
  openButton,
  queryOpenButton,
  where,
} from './fixtures/web-threads-b2.tsx'
import { pushThread } from './fixtures/web-threads-b3.tsx'
import { linksTo, renderB5, taskCard, textIn } from './fixtures/web-threads-b5.tsx'
import {
  REOPEN_LABEL,
  b6Actions,
  doneTask,
  reopenUpdatesBoard,
  reopened,
  setB6,
} from './fixtures/web-threads-b6.tsx'

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

const TITLE = 'Ship the nav'
// Finished a month ago: long out of the lists.
const LONG_AGO = NOW - 30 * DAY
const oldDone = (over: Partial<Task> = {}) => doneTask({ doneAt: LONG_AGO, ...over })

const SCREENS = {
  '/': <Threads />,
  '/t/:taskId': <Thread />,
  '/p/:projectId': <Project />,
}

async function reopenWithNote(user: UserEvent) {
  const sheet = await screen.findByRole('dialog', { name: 'Reopen task' })
  await user.click(within(sheet).getByRole('textbox', { name: REOPEN_LABEL }))
  await user.keyboard('The nav is broken on phones')
  await user.click(within(sheet).getByRole('button', { name: 'Reopen and send' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reopen task' })).toBeNull())
}

describe('B6-27 reopening brings a long-done task back', () => {
  installClock()

  it('reopened from its thread, it is on Threads again', async () => {
    setB6(oldDone())
    b6Actions.reopenTask.mockImplementation(reopenUpdatesBoard('main_ci'))
    renderB5('/t/t1', SCREENS)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    await reopenWithNote(user)
    // The snapshot after the write reaches the thread: the task is open again, so no Reopen.
    pushThread({})
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back to threads' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(openButton(TITLE)).toBeTruthy()
  })

  it("reopened from the Done tab's older list, it is on Threads again", async () => {
    setB6(oldDone({ afterDeploy: ['Open the site'], afterDone: [true] }))
    b6Actions.reopenTask.mockImplementation(reopenUpdatesBoard('after_deploy'))
    renderB5('/p/p-kanban?tab=done', SCREENS)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Show 1 older' }))
    await user.click(within(taskCard('t1')).getByRole('button', { name: /^Reopen/ }))
    await reopenWithNote(user)
    await waitFor(() => expect(where()).toBe('/t/t1'))
    await user.click(screen.getByRole('button', { name: 'Back to threads' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(openButton(TITLE)).toBeTruthy()
  })
})

describe('B6-27 a reopened task in the lists', () => {
  installClock()

  // Reopened an hour ago; `doneAt` as stored (null after reopenTask), or a stale old value.
  const back = (doneAt: number | null) => ({
    ...reopened(oldDone(), 'main_ci'),
    doneAt,
    reopenedAt: NOW - HOUR,
    updatedAt: NOW - HOUR,
  })
  const CASES = [
    ['doneAt cleared', null],
    ['a stale doneAt from a month ago', LONG_AGO],
  ] as const

  it.each(CASES)('is on Threads with %s', (_name, doneAt) => {
    setB6(back(doneAt))
    renderB5('/', SCREENS)
    expect(openButton(TITLE)).toBeTruthy()
  })

  it.each(CASES)("is on the project's Live tab, not Done, with %s", async (_name, doneAt) => {
    setB6(back(doneAt))
    renderB5('/p/p-kanban', SCREENS)
    expect(linksTo('/t/t1')).toHaveLength(1)
    expect(textIn(taskCard('t1'))).toContain(TITLE)
    await userEvent.setup().click(screen.getByRole('button', { name: /^Done/ }))
    expect(linksTo('/t/t1')).toHaveLength(0)
  })

  it('a task done a month ago and not reopened stays off Threads', () => {
    setB6(oldDone())
    renderB5('/', SCREENS)
    expect(LONG_AGO).toBeLessThan(NOW - DONE_VISIBLE_MS)
    expect(queryOpenButton(TITLE)).toBeNull()
  })
})

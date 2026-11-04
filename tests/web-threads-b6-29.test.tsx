// @vitest-environment jsdom
// web-threads B6, shared criterion 29 on the History and Reopen sheets: the archive read behind
// "Show earlier history" shows a loading status while it loads and, when Firestore rejects it, an
// error with a Retry that re-reads it (read errors are logged by data.ts, not by the sheet); an
// empty history has the prototype's empty copy; a refused reopen is the inline alert, and the
// note can be sent again.
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LOG_CAP, type LogEntry, type Task } from '../packages/shared/src/index.ts'
import HistorySheet from '../packages/web/src/components/HistorySheet.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { DAY, NOW, installClock, live, logSpy, type LiveStub } from './fixtures/web-threads-b2.tsx'
import { deniedWrite, renderThread } from './fixtures/web-threads-b3.tsx'
import { SAVE_ERROR } from './fixtures/web-threads-b4.tsx'
import { renderB5, textIn } from './fixtures/web-threads-b5.tsx'
import {
  REOPEN_LABEL,
  archive,
  b6Actions,
  doneTask,
  entry,
  lines,
  setArchive,
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

const DENIED = 'Missing or insufficient permissions.'
const COULD_NOT_LOAD = /Couldn.t load/
const EARLIER = 'Show earlier history'
const ARCHIVED = [entry(NOW - 40 * DAY, 'session', 'Archived plan.')]

const sheet = () => screen.getByRole('dialog', { name: 'Decision history' })

// The History sheet of a task with a full log, with the archive read in the given state.
function openFull(source: LiveStub<LogEntry[]>) {
  const task: Task = doneTask({ log: lines(LOG_CAP) })
  setB6(task)
  setArchive(source)
  renderB5('/t/t1', { '/t/:taskId': <HistorySheet task={task} onClose={vi.fn()} /> })
  return userEvent.setup()
}

describe('B6-29 the archive read in the History sheet', () => {
  installClock()

  it('shows a loading status while the earlier history loads', async () => {
    const user = openFull(live<LogEntry[]>([], { loading: true }))
    await user.click(within(sheet()).getByRole('button', { name: EARLIER }))
    expect(within(sheet()).getByRole('status', { name: /^Loading/ })).toBeTruthy()
    expect(textIn(sheet())).not.toMatch(COULD_NOT_LOAD)
    expect(within(sheet()).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('shows no loading status once it has loaded', async () => {
    const user = openFull(live(ARCHIVED))
    await user.click(within(sheet()).getByRole('button', { name: EARLIER }))
    expect(textIn(sheet())).toContain('Archived plan.')
    expect(within(sheet()).queryByRole('status', { name: /^Loading/ })).toBeNull()
    expect(textIn(sheet())).not.toMatch(COULD_NOT_LOAD)
    expect(within(sheet()).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('when the read fails, shows the error and Retry re-reads the archive', async () => {
    const user = openFull(live<LogEntry[]>([], { error: DENIED }))
    await user.click(within(sheet()).getByRole('button', { name: EARLIER }))
    expect(textIn(sheet())).toMatch(COULD_NOT_LOAD)
    // The rest of the history stays readable.
    expect(textIn(sheet())).toContain('Line 0.')
    await user.click(within(sheet()).getByRole('button', { name: 'Retry' }))
    expect(archive.source.retry).toHaveBeenCalled()
    expect(logSpy.error).not.toHaveBeenCalled()
  })
})

describe('B6-29 empty copy and a refused reopen', () => {
  installClock()

  it('an empty history says "Nothing recorded yet." and shows no loading status', () => {
    const task = doneTask({ log: [] })
    setB6(task)
    renderB5('/t/t1', { '/t/:taskId': <HistorySheet task={task} onClose={vi.fn()} /> })
    expect(textIn(sheet())).toContain('Nothing recorded yet.')
    expect(within(sheet()).queryByRole('status')).toBeNull()
  })

  it('a refused reopen shows "Couldn\'t save. Try again." and keeps the note for another try', async () => {
    setB6(doneTask())
    b6Actions.reopenTask.mockImplementation(deniedWrite)
    renderThread('/t/t1', <Thread />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    const reopen = await screen.findByRole('dialog', { name: 'Reopen task' })
    const note = within(reopen).getByRole<HTMLTextAreaElement>('textbox', { name: REOPEN_LABEL })
    await user.click(note)
    await user.keyboard('The nav is broken on phones')
    await user.click(within(reopen).getByRole('button', { name: 'Reopen and send' }))
    expect((await within(reopen).findByRole('alert')).textContent).toMatch(SAVE_ERROR)
    expect(note.value).toContain('The nav is broken on phones')
    b6Actions.reopenTask.mockImplementation(() => Promise.resolve())
    await user.click(within(reopen).getByRole('button', { name: 'Reopen and send' }))
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(2)
  })
})

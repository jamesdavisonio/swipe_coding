// @vitest-environment jsdom
// web-threads B6, criterion 26: Reopen. A done task's thread footer, each card of the project's
// Done tab and the History sheet's "Reopen task" open the Reopen sheet: a dialog named "Reopen
// task" with the task title as its heading, a line saying where the task goes back to, a required
// note ("What is wrong, or what should happen now?"), "Reopen and send" (disabled while the
// trimmed note is empty or the save is pending) and Cancel (no write). Saving calls
// reopenTask(task, note) once; when it resolves the sheet closes and James is taken to the thread
// unless he is on it; a refused save keeps the sheet and the note with an inline alert. Reopening
// logs user_action reopen and milestone_reached task_reopened under one request id. The thread
// shows a quiet "Reopened by you" line at the time of each "Reopened:" history entry by James.
// What reopenTask stores is tested in the emulator (tests/emulator/web-threads-b6-26.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { STAGE_LABEL, type Comment, type Task } from '../packages/shared/src/index.ts'
import Project from '../packages/web/src/pages/Project.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { DAY, HOUR, MINUTE, NOW, installClock, where } from './fixtures/web-threads-b2.tsx'
import {
  deniedWrite,
  occurrences,
  queryComposer,
  renderThread,
  sessionMsg,
  threadText,
} from './fixtures/web-threads-b3.tsx'
import { SAVE_ERROR, failures, userActions } from './fixtures/web-threads-b4.tsx'
import { isDisabled, renderB5, taskCard, textIn } from './fixtures/web-threads-b5.tsx'
import {
  AFTER_DEPLOY_LINE,
  REOPEN_LABEL,
  b6Actions,
  doneTask,
  entry,
  goesBackTo,
  milestones,
  pendingReopen,
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

const SHEET = 'Reopen task'
const STEPS = ['Open the site on your phone', 'Check the logs are quiet']
const NOTE = 'The nav is broken on phones'

const reopenSheet = () => screen.getByRole('dialog', { name: SHEET })
const querySheet = () => screen.queryByRole('dialog', { name: SHEET })
const noteField = () =>
  within(reopenSheet()).getByRole<HTMLTextAreaElement>('textbox', { name: REOPEN_LABEL })
const saveButton = () => within(reopenSheet()).getByRole('button', { name: 'Reopen and send' })

// The done task's thread, with the Reopen sheet opened from its footer.
async function openFromThread(task: Task = doneTask(), comments: Comment[] = []) {
  setB6(task, { comments })
  renderThread('/t/t1', <Thread />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Reopen' }))
  await screen.findByRole('dialog', { name: SHEET })
  return user
}

async function typeNote(user: UserEvent, text = NOTE) {
  await user.click(noteField())
  await user.keyboard(text)
}

// Two done tasks on the project's Done tab (t1 "Ship the nav", t2 "Add search").
function openDoneTab() {
  const task = doneTask()
  const other = { ...doneTask({ title: 'Add search', doneAt: NOW - DAY }), id: 't2' }
  setB6(task, { tasks: [other, task] })
  renderB5('/p/p-kanban?tab=done', { '/p/:projectId': <Project /> })
  return userEvent.setup()
}

describe('B6-26 Reopen on the thread', () => {
  installClock()

  it("a done task's footer offers Reopen and no composer", () => {
    setB6(doneTask())
    renderThread('/t/t1', <Thread />)
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy()
    expect(queryComposer()).toBeNull()
  })

  it('a task still in flight has no Reopen in its footer', () => {
    setB6(doneTask({ stage: 'main_ci', doneAt: null }))
    renderThread('/t/t1', <Thread />)
    expect(screen.getByRole('button', { name: 'Back to threads' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull()
  })

  it('a task in flight that keeps a stale doneAt has no Reopen in its footer', () => {
    setB6(doneTask({ stage: 'main_ci', doneAt: NOW - 30 * DAY }))
    renderThread('/t/t1', <Thread />)
    expect(screen.getByRole('button', { name: 'Back to threads' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull()
  })

  it('opens a dialog named Reopen task with the title, the note field and its buttons', async () => {
    await openFromThread()
    const sheet = within(reopenSheet())
    expect(sheet.getByRole('heading', { name: 'Ship the nav' })).toBeTruthy()
    expect(noteField()).toBeTruthy()
    expect(saveButton()).toBeTruthy()
    expect(sheet.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it.each([
    [
      'a feature with after-deploy steps',
      { afterDeploy: STEPS, afterDone: [true, true] },
      AFTER_DEPLOY_LINE,
    ],
    ['a feature', {}, goesBackTo(STAGE_LABEL.main_ci)],
    ['a bug fix', { type: 'bugfix' as const }, goesBackTo(STAGE_LABEL.main_ci)],
    ['a chore', { type: 'chore' as const }, goesBackTo(STAGE_LABEL.do)],
  ])('says where %s goes back to', async (_name, over, line) => {
    await openFromThread(doneTask(over))
    expect(textIn(reopenSheet())).toContain(line)
  })

  it('keeps Reopen and send disabled while the trimmed note is empty', async () => {
    const user = await openFromThread()
    expect(isDisabled(saveButton())).toBe(true)
    await typeNote(user, '   ')
    expect(isDisabled(saveButton())).toBe(true)
    await user.click(saveButton())
    expect(b6Actions.reopenTask).not.toHaveBeenCalled()
    await typeNote(user, 'x')
    expect(isDisabled(saveButton())).toBe(false)
  })

  it('Cancel closes the sheet and writes nothing', async () => {
    const user = await openFromThread()
    await typeNote(user)
    await user.click(within(reopenSheet()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(querySheet()).toBeNull())
    expect(b6Actions.reopenTask).not.toHaveBeenCalled()
    expect(userActions('reopen')).toHaveLength(0)
  })

  it('calls reopenTask once with the task and the note, closes, and stays on the thread', async () => {
    // Opened from a filtered Threads: staying on the thread keeps the way back to that filter.
    setB6(doneTask())
    renderThread({ pathname: '/t/t1', state: { from: '/?project=p-kanban' } }, <Thread />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    await screen.findByRole('dialog', { name: SHEET })
    await typeNote(user, `  ${NOTE}  `)
    await user.click(saveButton())
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(1)
    const [task, note] = b6Actions.reopenTask.mock.calls[0]
    expect(task).toEqual(expect.objectContaining({ id: 't1' }))
    expect(note.trim()).toBe(NOTE)
    await waitFor(() => expect(querySheet()).toBeNull())
    expect(where()).toBe('/t/t1')
    await user.click(screen.getByRole('button', { name: 'Back to threads' }))
    await waitFor(() => expect(where()).toBe('/?project=p-kanban'))
  })

  it('is disabled while the save is pending, so a second tap writes nothing', async () => {
    const user = await openFromThread()
    b6Actions.reopenTask.mockImplementation(pendingReopen)
    await typeNote(user)
    await user.click(saveButton())
    expect(isDisabled(saveButton())).toBe(true)
    await user.click(saveButton())
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(1)
    expect(reopenSheet()).toBeTruthy()
    expect(milestones('task_reopened')).toHaveLength(0)
  })

  it('on a refused save keeps the sheet and the note, alerts, and logs api_call_failed', async () => {
    const user = await openFromThread()
    b6Actions.reopenTask.mockImplementation(deniedWrite)
    await typeNote(user)
    await user.click(saveButton())
    expect((await within(reopenSheet()).findByRole('alert')).textContent).toMatch(SAVE_ERROR)
    expect(noteField().value.trim()).toBe(NOTE)
    expect(where()).toBe('/t/t1')
    expect(failures('reopen')).toHaveLength(1)
    expect(failures('reopen')[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect(milestones('task_reopened')).toHaveLength(0)
    // The note can be sent again.
    expect(isDisabled(saveButton())).toBe(false)
    b6Actions.reopenTask.mockImplementation(() => Promise.resolve())
    await user.click(saveButton())
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(2)
  })

  it('logs reopen and the task_reopened milestone with the task id, under one request id', async () => {
    const user = await openFromThread()
    await typeNote(user)
    await user.click(saveButton())
    await waitFor(() => expect(milestones('task_reopened')).toHaveLength(1))
    const taps = userActions('reopen')
    expect(taps).toHaveLength(1)
    const tap = taps[0][1] as { request_id?: unknown }
    expect(tap).toEqual(
      expect.objectContaining({ feature: 'web-threads', action: 'reopen', target: 't1' })
    )
    const milestone = milestones('task_reopened')[0][1] as { request_id?: unknown }
    expect(milestone).toEqual(
      expect.objectContaining({ feature: 'web-threads', milestone: 'task_reopened', target: 't1' })
    )
    expect(tap.request_id).toBeTruthy()
    expect(milestone.request_id).toBe(tap.request_id)
  })
})

describe('B6-26 Reopen from the Done tab and the History sheet', () => {
  installClock()

  it("each Done card's Reopen opens the sheet for that task and saving opens its thread", async () => {
    const user = openDoneTab()
    expect(within(taskCard('t1')).getByRole('button', { name: /^Reopen/ })).toBeTruthy()
    await user.click(within(taskCard('t2')).getByRole('button', { name: /^Reopen/ }))
    await screen.findByRole('dialog', { name: SHEET })
    expect(within(reopenSheet()).getByRole('heading', { name: 'Add search' })).toBeTruthy()
    await typeNote(user)
    await user.click(saveButton())
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(1)
    expect(b6Actions.reopenTask.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 't2' }))
    await waitFor(() => expect(where()).toBe('/t/t2'))
  })

  it("the History sheet's Reopen task opens the Reopen sheet, and saving opens the thread", async () => {
    const user = openDoneTab()
    await user.click(within(taskCard('t1')).getByRole('button', { name: /^History/ }))
    const history = await screen.findByRole('dialog', { name: 'Decision history' })
    await user.click(within(history).getByRole('button', { name: 'Reopen task' }))
    await screen.findByRole('dialog', { name: SHEET })
    expect(within(reopenSheet()).getByRole('heading', { name: 'Ship the nav' })).toBeTruthy()
    await typeNote(user)
    await user.click(saveButton())
    expect(b6Actions.reopenTask).toHaveBeenCalledTimes(1)
    expect(b6Actions.reopenTask.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 't1' }))
    await waitFor(() => expect(where()).toBe('/t/t1'))
  })

  it("Cancel on a Done card's sheet writes nothing and stays on the tab", async () => {
    const user = openDoneTab()
    await user.click(within(taskCard('t1')).getByRole('button', { name: /^Reopen/ }))
    await screen.findByRole('dialog', { name: SHEET })
    await user.click(within(reopenSheet()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(querySheet()).toBeNull())
    expect(b6Actions.reopenTask).not.toHaveBeenCalled()
    expect(where()).toBe('/p/p-kanban?tab=done')
  })
})

describe('B6-26 the "Reopened by you" line', () => {
  installClock()

  const REOPENED = 'Reopened by you'
  // A task James reopened an hour ago, back at Main CI.
  const reopenedTask = (log = [entry(NOW - HOUR, 'james', `Reopened: ${NOTE}`)]) =>
    doneTask({
      stage: 'main_ci',
      doneAt: null,
      reopenedAt: NOW - HOUR,
      log: [...doneTask().log, ...log],
    })

  it("shows at the time of James's Reopened entry, in order with the messages", () => {
    setB6(reopenedTask(), {
      comments: [
        sessionMsg('c1', 'done', 'Shipped the nav', NOW - 3 * HOUR),
        sessionMsg('c2', 'info', 'Looking into it', NOW - 10 * MINUTE),
      ],
    })
    renderThread('/t/t1', <Thread />)
    const text = threadText()
    expect(occurrences(REOPENED)).toBe(1)
    expect(text.indexOf('Shipped the nav')).toBeLessThan(text.indexOf(REOPENED))
    expect(text.indexOf(REOPENED)).toBeLessThan(text.indexOf('Looking into it'))
  })

  it('shows one line per reopen', () => {
    setB6(
      reopenedTask([
        entry(NOW - 5 * HOUR, 'james', 'Reopened: First try'),
        entry(NOW - HOUR, 'james', 'Reopened: Second try'),
      ]),
      { comments: [sessionMsg('c1', 'done', 'Shipped again', NOW - 3 * HOUR)] }
    )
    renderThread('/t/t1', <Thread />)
    const text = threadText()
    expect(occurrences(REOPENED)).toBe(2)
    expect(text.indexOf(REOPENED)).toBeLessThan(text.indexOf('Shipped again'))
    expect(text.lastIndexOf(REOPENED)).toBeGreaterThan(text.indexOf('Shipped again'))
  })

  it('shows no line for other entries or for a Reopened entry not by James', () => {
    setB6(
      reopenedTask([
        entry(NOW - 2 * HOUR, 'session', 'Reopened: by the session'),
        entry(NOW - HOUR, 'james', 'Approved spec v2'),
      ]),
      { comments: [sessionMsg('c1', 'info', 'Looking into it', NOW - 10 * MINUTE)] }
    )
    renderThread('/t/t1', <Thread />)
    expect(threadText()).toContain('Looking into it')
    expect(occurrences(REOPENED)).toBe(0)
  })
})

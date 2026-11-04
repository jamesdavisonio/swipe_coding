// @vitest-environment jsdom
// web-threads B5, criterion 23: New task. James picks a project, a type, a title (required), a
// description and optionally after-deploy steps (one per line); the preview shows the resulting
// stage list; Queue task calls createTask once with the cleaned input and returns to Threads,
// where the new row is visible. A refused save keeps the form with an inline alert. And the
// thread of a task James queued shows "Queued by you · waiting for a session in <project>"
// until the session posts. What createTask stores is tested in the emulator
// (tests/emulator/web-threads-b5-23.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { STAGE_LABEL, stagesFor, type TaskType } from '../packages/shared/src/index.ts'
import NewTask from '../packages/web/src/pages/NewTask.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  NOW,
  board,
  installClock,
  live,
  logSpy,
  makeTask,
  openButton,
  where,
} from './fixtures/web-threads-b2.tsx'
import {
  deniedWrite,
  pushThread,
  renderThread,
  sessionMsg,
  setThread,
  threadText,
} from './fixtures/web-threads-b3.tsx'
import { SAVE_ERROR, failures, userActions } from './fixtures/web-threads-b4.tsx'
import {
  NEW_TASK_ID,
  b5Actions,
  b5Text,
  isDisabled,
  pendingCreate,
  pressable,
  renderB5,
  setB5Board,
  type NewTaskInput,
} from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b5.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const open = (path = '/new') => {
  renderB5(path, { '/new': <NewTask /> })
  return userEvent.setup()
}

const projectSelect = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Project' })
const selectedProject = () => projectSelect().selectedOptions[0]?.textContent?.trim()
const titleField = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Title/ })
const descriptionField = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description for the session' })
const stepsBox = () =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: 'I have steps to do after deploy' })
const stepsField = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'One per line' })
const queryStepsField = () => screen.queryByRole('textbox', { name: 'One per line' })
const queueButton = () => screen.getByRole('button', { name: 'Queue task' })

const preview = (type: TaskType, steps: boolean) =>
  `Stages: ${stagesFor(type, steps)
    .map((s) => STAGE_LABEL[s])
    .join(' → ')}`

const milestones = () =>
  logSpy.event.mock.calls.filter(
    (call) =>
      call[0] === 'milestone_reached' &&
      (call[1] as { milestone?: string }).milestone === 'task_queued'
  )

// Fills the whole form: website, Bug fix, a padded title and description, three step lines
// with a blank and padding.
async function fillForm(user: UserEvent) {
  await user.selectOptions(projectSelect(), 'website')
  await user.click(screen.getByRole('button', { name: 'Bug fix' }))
  await user.type(titleField(), '  Fix the header  ')
  await user.type(descriptionField(), '  It overlaps the list on small phones.  ')
  await user.click(stepsBox())
  await user.type(
    stepsField(),
    '  Open the site on a phone  {Enter}{Enter}   {Enter}Check the logs '
  )
}

const FILLED: NewTaskInput = {
  type: 'bugfix',
  title: 'Fix the header',
  description: 'It overlaps the list on small phones.',
  afterDeploy: ['Open the site on a phone', 'Check the logs'],
}

describe('B5-23 the New task form', () => {
  installClock()

  it('offers every project by name in the select, defaulting to the first', () => {
    setB5Board()
    open()
    const names = within(projectSelect())
      .getAllByRole('option')
      .map((o) => o.textContent?.trim())
    expect(names).toEqual(['kanban', 'website', 'calendar'])
    expect(selectedProject()).toBe('kanban')
  })

  it('preselects the project the URL names', () => {
    setB5Board()
    open('/new?project=p-cal')
    expect(selectedProject()).toBe('calendar')
  })

  it('has the type buttons with Feature pressed by default, and one pressed at a time', async () => {
    setB5Board()
    const user = open()
    const TYPES = ['Feature', 'Bug fix', 'Chore']
    const pressed = () =>
      TYPES.filter(
        (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true'
      )
    for (const name of TYPES)
      expect(['true', 'false']).toContain(
        screen.getByRole('button', { name }).getAttribute('aria-pressed')
      )
    expect(pressed()).toEqual(['Feature'])
    await user.click(screen.getByRole('button', { name: 'Chore' }))
    expect(pressed()).toEqual(['Chore'])
    expect(pressable()).toHaveLength(3)
  })

  it('has a required Title and a Description for the session', () => {
    setB5Board()
    open()
    const title = titleField()
    expect(title.required || title.getAttribute('aria-required') === 'true').toBe(true)
    expect(descriptionField()).toBeTruthy()
  })

  it('reveals the "One per line" steps field only when James has steps after deploy', async () => {
    setB5Board()
    const user = open()
    expect(stepsBox().checked).toBe(false)
    expect(queryStepsField()).toBeNull()
    await user.click(stepsBox())
    expect(stepsField()).toBeTruthy()
  })
})

describe('B5-23 the stage preview', () => {
  installClock()

  it('shows the feature chain by default', () => {
    setB5Board()
    open()
    expect(b5Text()).toContain(preview('feature', false))
  })

  it.each([
    ['Bug fix', 'bugfix'],
    ['Chore', 'chore'],
    ['Feature', 'feature'],
  ] as const)('follows the type: %s', async (label, type) => {
    setB5Board()
    const user = open()
    await user.click(screen.getByRole('button', { name: 'Chore' }))
    await user.click(screen.getByRole('button', { name: label }))
    expect(b5Text()).toContain(preview(type, false))
  })

  it('adds After deploy when there are steps, and drops it when the box is unticked', async () => {
    setB5Board()
    const user = open()
    await user.click(stepsBox())
    await user.type(stepsField(), 'Open the site')
    expect(b5Text()).toContain(preview('feature', true))
    await user.click(screen.getByRole('button', { name: 'Bug fix' }))
    expect(b5Text()).toContain(preview('bugfix', true))
    await user.click(stepsBox())
    expect(b5Text()).toContain(preview('bugfix', false))
    expect(b5Text()).not.toContain(STAGE_LABEL.after_deploy)
  })
})

describe('B5-23 Queue task', () => {
  installClock()

  it('is disabled while the trimmed title is empty', async () => {
    setB5Board()
    const user = open()
    expect(isDisabled(queueButton())).toBe(true)
    await user.type(titleField(), '   ')
    expect(isDisabled(queueButton())).toBe(true)
    await user.click(queueButton())
    expect(b5Actions.createTask).not.toHaveBeenCalled()
    await user.type(titleField(), 'Add search')
    expect(isDisabled(queueButton())).toBe(false)
  })

  it('calls createTask once with the trimmed title and description and the clean steps', async () => {
    setB5Board()
    const user = open()
    await fillForm(user)
    await user.click(queueButton())
    expect(b5Actions.createTask).toHaveBeenCalledTimes(1)
    const [projectId, input] = b5Actions.createTask.mock.calls[0]
    expect(projectId).toBe('p-site')
    expect(input).toEqual(FILLED)
  })

  it('sends no steps when the box is unticked again, and the defaults when untouched', async () => {
    setB5Board()
    const user = open()
    await user.click(stepsBox())
    await user.type(stepsField(), 'Open the site')
    await user.click(stepsBox())
    await user.type(titleField(), 'Add search')
    await user.click(queueButton())
    expect(b5Actions.createTask).toHaveBeenCalledTimes(1)
    expect(b5Actions.createTask.mock.calls[0]).toEqual([
      'p-kanban',
      { type: 'feature', title: 'Add search', description: '', afterDeploy: [] },
    ])
  })

  it('returns to Threads once the save resolves, with the new row visible', async () => {
    setB5Board()
    // The new task reaches the board the way a Firestore snapshot would.
    b5Actions.createTask.mockImplementation((projectId: string, input: NewTaskInput) => {
      board.tasks = live([
        ...board.tasks.data,
        makeTask(NEW_TASK_ID, {
          projectId,
          type: input.type,
          title: input.title,
          afterDeploy: input.afterDeploy,
          updatedAt: NOW,
        }),
      ])
      return Promise.resolve(NEW_TASK_ID)
    })
    renderB5('/new', { '/new': <NewTask />, '/': <Threads /> })
    const user = userEvent.setup()
    await fillForm(user)
    await user.click(queueButton())
    await waitFor(() => expect(where()).toBe('/'))
    expect(screen.getByRole('heading', { name: 'Threads' })).toBeTruthy()
    expect(openButton('Fix the header')).toBeTruthy()
  })

  it('logs queue_task and the task_queued milestone with the new id, under one request id', async () => {
    setB5Board()
    const user = open()
    await user.type(titleField(), 'Add search')
    await user.click(queueButton())
    await waitFor(() => expect(milestones()).toHaveLength(1))
    expect(userActions('queue_task')).toHaveLength(1)
    const tap = userActions('queue_task')[0][1] as { request_id?: unknown }
    expect(tap).toEqual(
      expect.objectContaining({ feature: 'web-threads', action: 'queue_task', target: NEW_TASK_ID })
    )
    const milestone = milestones()[0][1] as { request_id?: unknown }
    expect(milestone).toEqual(
      expect.objectContaining({
        feature: 'web-threads',
        milestone: 'task_queued',
        target: NEW_TASK_ID,
      })
    )
    expect(tap.request_id).toBeTruthy()
    expect(milestone.request_id).toBe(tap.request_id)
  })

  it('is disabled while the save is pending, so a second tap writes nothing', async () => {
    setB5Board()
    b5Actions.createTask.mockImplementation(pendingCreate)
    const user = open()
    await user.type(titleField(), 'Add search')
    await user.click(queueButton())
    expect(isDisabled(queueButton())).toBe(true)
    await user.click(queueButton())
    expect(b5Actions.createTask).toHaveBeenCalledTimes(1)
    expect(where()).toBe('/new')
    expect(milestones()).toHaveLength(0)
  })

  it('on a refused save shows the alert, keeps the form, and logs api_call_failed', async () => {
    setB5Board()
    b5Actions.createTask.mockImplementation(deniedWrite)
    const user = open()
    await fillForm(user)
    await user.click(queueButton())
    expect((await screen.findByRole('alert')).textContent).toMatch(SAVE_ERROR)
    expect(where()).toBe('/new')
    expect(selectedProject()).toBe('website')
    expect(titleField().value.trim()).toBe('Fix the header')
    expect(descriptionField().value.trim()).toBe('It overlaps the list on small phones.')
    expect(screen.getByRole('button', { name: 'Bug fix' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(stepsField().value).toContain('Check the logs')
    expect(failures('queue_task')).toHaveLength(1)
    expect(failures('queue_task')[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect(milestones()).toHaveLength(0)
    // The form can be saved again.
    expect(isDisabled(queueButton())).toBe(false)
    b5Actions.createTask.mockImplementation(() => Promise.resolve(NEW_TASK_ID))
    await user.click(queueButton())
    expect(b5Actions.createTask).toHaveBeenCalledTimes(2)
    expect(b5Actions.createTask.mock.calls[1]).toEqual(['p-site', FILLED])
  })
})

describe('B5-23 the queue line in the thread view', () => {
  installClock()

  const QUEUED = 'Queued by you · waiting for a session in website'
  // makeTask's defaults are James's fresh task: createdBy james, agentId null, first stage.
  const queued = makeTask('t1', { projectId: 'p-site', title: 'Fix the header', type: 'bugfix' })

  it('shows the queue line instead of "No messages yet." while a task James queued waits', () => {
    setThread(queued)
    renderThread('/t/t1', <Thread />)
    expect(threadText()).toContain(QUEUED)
    expect(threadText()).not.toContain('No messages yet.')
  })

  it('drops the line once the session posts', () => {
    setThread(queued)
    renderThread('/t/t1', <Thread />)
    expect(threadText()).toContain(QUEUED)
    pushThread({ comments: [sessionMsg('c1', 'info', 'Picked this up', NOW)] })
    expect(threadText()).toContain('Picked this up')
    expect(threadText()).not.toContain('Queued by you')
  })

  it.each([
    ['bound to a session', { agentId: 'agent-1' }],
    ['past its first stage', { stage: 'pr' as const }],
    ['created by the session', { createdBy: 'agent' as const }],
  ])('shows "No messages yet." instead for a task %s', (_name, over) => {
    setThread({ ...queued, ...over })
    renderThread('/t/t1', <Thread />)
    expect(threadText()).toContain('No messages yet.')
    expect(threadText()).not.toContain('Queued by you')
  })
})

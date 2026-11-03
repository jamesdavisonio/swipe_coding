// Shared fixture for the web-threads B4 suites (the decision sheet). Builds on the B2 and B3
// fixtures: same task builder, board, thread sources, action spies and logger spy. Adds the B4
// data.ts writes (requestChange, tickStep), one task per kind of need, and a way to mount the
// real DecisionSheet on its own with an onClose spy (inside a router, like the app). The suite
// passes the sheet in: this module is loaded by the data.ts mock, so it must not import the app.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () => (await import(B4)).dataModule())
// DecisionSheet is never mocked here: it is the screen under test.
import { vi, type Mock } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Task } from '../../packages/shared/src/index.ts'
import { actions, logSpy, makeTask } from './web-threads-b2.tsx'
import { dataModule as b3DataModule, setThread } from './web-threads-b3.tsx'

// ---- tasks, one per kind of need ------------------------------------------------------

export const specTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Add search',
    stage: 'spec',
    needs: { kind: 'spec' },
    spec: {
      goal: 'Find any task by its title',
      points: ['A search box above the list', 'Matches as you type'],
      out: 'Searching comments',
      touches: 'Threads screen',
      version: 3,
    },
    ...over,
  })

export const questionTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Pick a font',
    stage: 'build',
    needs: {
      kind: 'question',
      question: 'Which font should we use?',
      options: [
        { key: 'A', label: 'Inter' },
        { key: 'B', label: 'Atkinson' },
      ],
    },
    ...over,
  })

export const prTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Fix the header',
    type: 'bugfix',
    stage: 'pr',
    needs: { kind: 'pr' },
    pr: { number: 42, url: 'https://github.com/nullnoise/kanban/pull/42' },
    summary: 'Header no longer overlaps the list on small phones.',
    ...over,
  })

export const STEPS = ['Open the site on your phone', 'Check the logs are quiet']
export const afterDeployTask = (over: Partial<Task> = {}) =>
  makeTask('t1', {
    title: 'Ship the footer',
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: STEPS,
    afterDone: [false, false],
    ...over,
  })

// ---- mocked data.ts (B2 + B3 + the B4 writes) ------------------------------------------

const resolved = () => Promise.resolve()

export const b4Actions = {
  requestChange: vi.fn((_task: Task, _text: string) => Promise.resolve()),
  tickStep: vi.fn((_task: Task, _index: number) => Promise.resolve()),
}

export const dataModule = () => ({
  ...b3DataModule(),
  ...b4Actions,
})

// Every write the sheet can make, for "no side effects" checks.
export const writeSpies = (): Mock[] => [
  actions.approveSpec,
  actions.answerQuestion,
  actions.markMerged,
  b4Actions.requestChange,
  b4Actions.tickStep,
]
export const writeCount = () => writeSpies().reduce((n, spy) => n + spy.mock.calls.length, 0)

// Loads the task as the thread's and the board's only task, and resets every write spy to a
// write that succeeds.
export function setSheetTask(task: Task | null) {
  setThread(task)
  for (const spy of writeSpies()) {
    spy.mockReset()
    spy.mockImplementation(resolved)
  }
}

// ---- mounting the real sheet ------------------------------------------------------------

export type SheetComponent = ComponentType<{
  task: Task
  mode: 'read' | 'change'
  onClose: () => void
}>

// The real DecisionSheet with an onClose spy. `rerender(next)` feeds the sheet a new snapshot
// of the task, the way the parent screens do.
export function renderSheet(
  DecisionSheet: SheetComponent,
  task: Task,
  mode: 'read' | 'change' = 'read'
) {
  setSheetTask(task)
  const onClose = vi.fn()
  const view = (t: Task) => (
    <MemoryRouter>
      <DecisionSheet task={t} mode={mode} onClose={onClose} />
    </MemoryRouter>
  )
  const result = render(view(task))
  return {
    onClose,
    user: userEvent.setup(),
    rerender: (next: Task) => result.rerender(view(next)),
  }
}

// ---- reading the sheet ------------------------------------------------------------------

export const dialog = () => screen.getByRole('dialog')
export const inDialog = () => within(dialog())
export const sheetText = () => (dialog().textContent ?? '').replace(/\s+/g, ' ')
export const SAVE_ERROR = /Couldn.t save\. Try again\./

// The user_action events with this action, as logged through `track`.
export const userActions = (action: string) =>
  logSpy.event.mock.calls.filter(
    (call) => call[0] === 'user_action' && (call[1] as { action?: string }).action === action
  )

// The api_call_failed errors logged for this action.
export const failures = (action: string) =>
  logSpy.error.mock.calls.filter(
    (call) =>
      call[0] === 'api_call_failed' &&
      (call[2] as { action?: string } | undefined)?.action === action
  )

// The request id of the one user_action logged for `action`.
export function tapRequestId(action: string): unknown {
  const taps = userActions(action)
  if (taps.length !== 1) throw new Error(`expected one ${action} tap, saw ${taps.length}`)
  return (taps[0][1] as { request_id?: unknown }).request_id
}

export { actions, logSpy }

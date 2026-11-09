// @vitest-environment jsdom
// launch-session 119, the screen: Start session writes one task through createTask with
// launch: true (the project chosen, the type, the name as title, the idea as description), then
// the sheet closes and the toast says "Starting a session for <name>". The stored shape is the
// emulator suite tests/emulator/launch-session-119.test.ts.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { installClock, logSpy, specTask } from './fixtures/web-threads-b2.tsx'
import {
  createTask,
  openSheet,
  projectSelect,
  renderDeck,
  sheetOpen,
  startButton,
  toastText,
  typeIdea,
  typeName,
} from './fixtures/launch-session-web.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const userActions = () => logSpy.event.mock.calls.filter((c) => c[0] === 'user_action')
const flush = () => act(async () => void (await Promise.resolve()))

describe('launch-session 119: sending the request', () => {
  installClock()

  it('writes one launching task for the preselected project, as a feature by default', async () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    typeName('Search page')
    typeIdea('Search by title and by project.')
    fireEvent.click(startButton())
    await flush()
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(createTask).toHaveBeenCalledWith(
      'p-workshop',
      expect.objectContaining({
        type: 'feature',
        title: 'Search page',
        description: 'Search by title and by project.',
        launch: true,
      })
    )
  })

  it('uses the project and the type James picked', async () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    const sheet = openSheet()
    fireEvent.change(projectSelect(), {
      target: {
        value: within(projectSelect())
          .getByRole('option', { name: 'kanban' })
          .getAttribute('value'),
      },
    })
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Bugfix' }))
    typeName('Mend the export')
    fireEvent.click(startButton())
    await flush()
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(createTask).toHaveBeenCalledWith(
      'p-kanban',
      expect.objectContaining({ type: 'bugfix', title: 'Mend the export', launch: true })
    )
  })

  it('an empty idea is sent as an empty description', async () => {
    renderDeck([])
    openSheet()
    typeName('Tidy up')
    fireEvent.click(startButton())
    await flush()
    expect(createTask).toHaveBeenCalledWith(
      'p-kanban',
      expect.objectContaining({ title: 'Tidy up', description: '', launch: true })
    )
  })

  it('then closes the sheet and shows the toast', async () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    typeName('Search page')
    fireEvent.click(startButton())
    await flush()
    expect(sheetOpen()).toBe(false)
    expect(toastText()).toBe('Starting a session for Search page')
    expect(screen.queryByRole('dialog', { name: 'New session' })).toBeNull()
  })

  it('logs one user_action start_session targeting the new task, after the save', async () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    typeName('Search page')
    fireEvent.click(startButton())
    expect(userActions()).toHaveLength(0)
    await flush()
    const calls = userActions()
    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toMatchObject({ action: 'start_session', target: 't-new' })
    expect(typeof (calls[0][1] as { feature?: unknown }).feature).toBe('string')
  })

  it('writes nothing and shows no toast until Start is tapped', () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    typeName('Search page')
    expect(createTask).not.toHaveBeenCalled()
    expect(toastText()).not.toContain('Starting a session')
  })
})

// @vitest-environment jsdom
// launch-session 118: Start session is disabled while the name is blank; while a save is pending a
// second tap writes nothing; a refused save keeps the sheet and its text and says it could not be
// sent ("Couldn't start it. Try again.").
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { installClock, logSpy, specTask } from './fixtures/web-threads-b2.tsx'
import { pendingCreate } from './fixtures/web-threads-b5.tsx'
import {
  createTask,
  ideaField,
  nameField,
  openSheet,
  renderDeck,
  sheetOpen,
  startButton,
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

const open = () => {
  renderDeck([specTask({ projectId: 'p-workshop' })])
  openSheet()
}
const flush = () => act(async () => void (await Promise.resolve()))

describe('launch-session 118: Start session', () => {
  installClock()

  it('is disabled while the name is blank, and enabled once there is a name', () => {
    open()
    expect((startButton() as HTMLButtonElement).disabled).toBe(true)
    typeName('   ')
    expect((startButton() as HTMLButtonElement).disabled).toBe(true)
    typeIdea('An idea without a name')
    expect((startButton() as HTMLButtonElement).disabled).toBe(true)
    typeName('Search page')
    expect((startButton() as HTMLButtonElement).disabled).toBe(false)
    typeName('')
    expect((startButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('a tap on the disabled button writes nothing', () => {
    open()
    fireEvent.click(startButton())
    expect(createTask).not.toHaveBeenCalled()
    expect(sheetOpen()).toBe(true)
  })

  it('while the save is pending a second tap writes nothing', async () => {
    createTask.mockImplementation(pendingCreate)
    open()
    typeName('Search page')
    fireEvent.click(startButton())
    fireEvent.click(startButton())
    await flush()
    fireEvent.click(startButton())
    expect(createTask).toHaveBeenCalledTimes(1)
  })

  it('a refused save keeps the sheet and its text and says it could not be sent', async () => {
    createTask.mockRejectedValue(new Error('permission-denied'))
    open()
    typeName('Search page')
    typeIdea('Search by title and by project.')
    fireEvent.click(startButton())
    await flush()
    expect(sheetOpen()).toBe(true)
    expect(nameField().value).toBe('Search page')
    expect(ideaField().value).toBe('Search by title and by project.')
    expect(screen.getByRole('dialog', { name: 'New session' }).textContent).toContain(
      "Couldn't start it. Try again."
    )
    expect(screen.queryByRole('status')?.textContent ?? '').not.toContain('Starting a session')
    expect(logSpy.event.mock.calls.filter((c) => c[0] === 'user_action')).toHaveLength(0)
  })

  it('after a refused save the same text can be sent again', async () => {
    createTask.mockRejectedValueOnce(new Error('offline'))
    open()
    typeName('Search page')
    fireEvent.click(startButton())
    await flush()
    expect(createTask).toHaveBeenCalledTimes(1)
    fireEvent.click(startButton())
    await flush()
    expect(createTask).toHaveBeenCalledTimes(2)
    expect(sheetOpen()).toBe(false)
  })
})

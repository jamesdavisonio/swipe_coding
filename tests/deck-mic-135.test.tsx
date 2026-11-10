// @vitest-environment jsdom
// deck-mic 135: with speech recognition, "Change it" opens the note sheet titled "Note for
// <session>", already listening; the line under the title still says what the note does for that
// card kind.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  deployTask,
  fixTask,
  mergeTask,
  NOW,
  nextTask,
  renderAt,
  setBoard,
  specTask,
  summaryTask,
} from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  LISTENING_LINE,
  installRecognition,
  micStatus,
  uninstallRecognition,
} from './fixtures/fake-recognition.ts'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  installRecognition()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  uninstallRecognition()
})

describe('deck-mic 135: the note sheet opens listening', () => {
  it('is titled "Note for <session>" and listens at once', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(screen.getByRole('dialog', { name: 'Note for Order the replies' })).toBeTruthy()
    expect(FakeRecognition.current().start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    expect(micStatus()).toBe(LISTENING_LINE)
  })

  it.each([
    ['spec', specTask(), 'Your note asks for a revised spec.'],
    ['merge', mergeTask(), 'Your note asks for changes before the merge.'],
    ['after_deploy', deployTask(), 'Your note goes to the session as a comment.'],
    ['summary', summaryTask(), 'Your note goes to the session as a comment.'],
    ['next', nextTask(), 'Your note becomes the new task’s description.'],
    ['question', fixTask(), 'Your note is the answer.'],
  ])('a %s card: the line says what the note does, while it listens', (_k, task, does) => {
    setBoard({ tasks: [task] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(screen.getByRole('dialog').textContent).toContain(does)
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
  })
})

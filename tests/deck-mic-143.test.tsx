// @vitest-environment jsdom
// deck-mic 143: without speech recognition, or once the microphone is refused, the note sheet is
// only the text box and the send arrow (no microphone button); words heard before a refusal stay.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { actions, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  editTextButton,
  heardNow,
  installRecognition,
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
  installRecognition()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  uninstallRecognition()
})

const openNote = () => {
  setBoard({ tasks: [specTask()] })
  renderAt('/', <Deck />)
  fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
}
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const note = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your note' })

// Only the text box and the arrow: no microphone, no tappable text, no microphone status line.
const expectTypingOnly = () => {
  const sheet = within(screen.getByRole('dialog'))
  for (const name of ['Start talking', 'Add more', 'Stop listening']) {
    expect(sheet.queryByRole('button', { name })).toBeNull()
  }
  expect(editTextButton()).toBeNull()
  expect(heardNow()).toBeNull()
  expect(sheet.queryByTestId('mic-status')).toBeNull()
  expect(sheet.getByRole('button', { name: 'Send' })).toBeTruthy()
}

describe('deck-mic 143: typing only', () => {
  it('without speech recognition: the text box and the arrow, and the typed note sends', () => {
    uninstallRecognition()
    openNote()
    expectTypingOnly()
    fireEvent.change(note(), { target: { value: 'typed change' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec1' }),
      'typed change'
    )
  })

  it.each(['not-allowed', 'service-not-allowed', 'audio-capture'])(
    'a refused microphone (%s) leaves the box with the words heard before it',
    (error) => {
      openNote()
      expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
      const r = FakeRecognition.current()
      r.say('half a note', true)
      r.fail(error)
      wait(60_000)
      expectTypingOnly()
      expect(note().value).toBe('half a note')
      expect(FakeRecognition.starts()).toBe(1)
    }
  )

  it('a refusal after a restart keeps the words of every run, and they send', () => {
    openNote()
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    FakeRecognition.current().say('one', true)
    FakeRecognition.current().endByItself()
    wait(250)
    FakeRecognition.current().say('two', true)
    FakeRecognition.current().fail('not-allowed')
    expectTypingOnly()
    expect(note().value).toBe('one two')
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec1' }),
      'one two'
    )
  })
})

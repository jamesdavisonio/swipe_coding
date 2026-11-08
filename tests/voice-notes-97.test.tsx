// @vitest-environment jsdom
// voice-notes 97: a microphone-refusing error never restarts and falls back to typing; closing the
// sheet throws the words away and nothing restarts afterwards. Through the voice sheet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  installRecognition,
  micStopped,
  sheetWords,
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
  return FakeRecognition.current()
}
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe('voice-notes 97 refusal and closing', () => {
  it.each(['not-allowed', 'service-not-allowed', 'audio-capture'])(
    '%s never restarts and shows the text box',
    (error) => {
      const r = openNote()
      r.fail(error)
      wait(60_000)
      expect(FakeRecognition.starts()).toBe(1)
      expect(screen.getByRole('textbox', { name: 'Your note' })).toBeTruthy()
    }
  )

  it('a refusal after some words keeps them in the text box, still without a restart', () => {
    const r = openNote()
    r.say('half a note', true)
    r.fail('not-allowed')
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your note' })
    expect(box.value).toBe('half a note')
  })

  it('closing the sheet throws the words away and nothing restarts', () => {
    const r = openNote()
    r.say('throw this away', true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    // A late end event from the browser after the close must not bring it back.
    act(() => void r.onend?.())
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(sheetWords()).not.toContain('throw this away')
  })

  it('closing between a self-ended run and its restart cancels the restart and the timers', () => {
    const r = openNote()
    r.say('gone soon', true)
    r.endByItself()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    const n = FakeRecognition.starts()
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(n)
    const last = FakeRecognition.current()
    // A restart that did happen (synchronously, before the close) must have been shut again.
    if (FakeRecognition.starts() > 1) {
      expect(last.abort.mock.calls.length + last.stop.mock.calls.length).toBeGreaterThan(0)
    }
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a note opened right after closing is not stopped early by the old timers', () => {
    const r = openNote()
    r.say('old note', true)
    wait(10_000)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(FakeRecognition.starts()).toBe(2)
    wait(14_000)
    expect(micStopped()).toBe(false)
  })
})

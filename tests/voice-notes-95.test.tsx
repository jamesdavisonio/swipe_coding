// @vitest-environment jsdom
// voice-notes 95: a run that ends by itself (Android, after a pause) while James has not stopped
// it starts again; what was said is kept, new words follow after one space, and the microphone
// keeps showing that it is listening. Through the voice sheet.
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

describe('voice-notes 95 restart after the browser ends a run', () => {
  it('starts recognition again and keeps showing the microphone as listening', () => {
    const r = openNote()
    r.say('make it faster', true)
    expect(FakeRecognition.starts()).toBe(1)
    r.endByItself()
    expect(micStopped()).toBe(false)
    wait(1000)
    expect(FakeRecognition.starts()).toBe(2)
    expect(micStopped()).toBe(false)
    expect(sheetWords()).toBe('make it faster')
  })

  it.each(['no-speech', 'network'])(
    'restarts after a non-refusing %s error, keeping the words',
    (error) => {
      const r = openNote()
      r.say('earlier words', true)
      r.fail(error)
      wait(1000)
      expect(FakeRecognition.starts()).toBe(2)
      expect(micStopped()).toBe(false)
      expect(sheetWords()).toBe('earlier words')
    }
  )

  it('adds the new words after the old ones with one space', () => {
    const r = openNote()
    r.say('make it faster', true)
    r.endByItself()
    wait(1000)
    FakeRecognition.current().say('and shorter', true)
    expect(sheetWords()).toBe('make it faster and shorter')
  })

  it('applies the repeated-stretch rule inside the new run too', () => {
    const r = openNote()
    r.say('make it faster', true)
    r.endByItself()
    wait(1000)
    FakeRecognition.current().sayResults([
      ['and short', false],
      ['and shorter', false],
    ])
    expect(sheetWords()).toBe('make it faster and shorter')
  })

  it('restarts again after a second pause, keeping every part', () => {
    const r = openNote()
    r.say('one', true)
    r.endByItself()
    wait(1000)
    FakeRecognition.current().say('two', true)
    FakeRecognition.current().endByItself()
    wait(1000)
    FakeRecognition.current().say('three', true)
    expect(FakeRecognition.starts()).toBe(3)
    expect(sheetWords()).toBe('one two three')
  })

  it('restarts when nothing was said yet, without a leading space', () => {
    const r = openNote()
    r.endByItself()
    wait(1000)
    expect(FakeRecognition.starts()).toBe(2)
    expect(micStopped()).toBe(false)
    FakeRecognition.current().say('hello', true)
    expect(sheetWords()).toBe('hello')
  })
})

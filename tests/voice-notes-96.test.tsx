// @vitest-environment jsdom
// voice-notes 96: listening ends (microphone stopped, text kept) when James taps stop, after 15 s
// with no result event, or 3 min after he started; nothing restarts until he taps the microphone
// again. The sheet has no stop control, so the tap-stop case drives the hook with renderHook;
// the rest go through the voice sheet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  MAX_LISTEN_MS,
  SILENCE_MS,
  useRecognition,
} from '../packages/web/src/components/deck/use-recognition.ts'
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

describe('voice-notes 96 when listening ends', () => {
  it('exports the two limits as 15 seconds and 3 minutes', () => {
    expect(SILENCE_MS).toBe(15_000)
    expect(MAX_LISTEN_MS).toBe(180_000)
  })

  it('stops after 15 s with no result, keeps the words, and does not restart', () => {
    const r = openNote()
    r.say('keep these words', true)
    wait(SILENCE_MS - 100)
    expect(micStopped()).toBe(false)
    wait(200)
    expect(micStopped()).toBe(true)
    expect(sheetWords()).toBe('keep these words')
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(micStopped()).toBe(true)
  })

  it('a self-ended run and its restart do not reset the silence clock', () => {
    const r = openNote()
    r.say('hello', true)
    wait(5000)
    r.endByItself()
    wait(1000)
    expect(FakeRecognition.starts()).toBe(2)
    wait(SILENCE_MS - 6000 - 100)
    expect(micStopped()).toBe(false)
    wait(200)
    expect(micStopped()).toBe(true)
    expect(sheetWords()).toBe('hello')
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(2)
  })

  it('the browser end event that follows a silence stop does not restart', () => {
    const r = openNote()
    r.say('hello', true)
    wait(SILENCE_MS + 100)
    expect(micStopped()).toBe(true)
    r.endByItself()
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(micStopped()).toBe(true)
  })

  it('stops after 15 s when nothing was said at all', () => {
    openNote()
    wait(SILENCE_MS - 100)
    expect(micStopped()).toBe(false)
    wait(200)
    expect(micStopped()).toBe(true)
  })

  it('counts the 15 s from the latest result event', () => {
    const r = openNote()
    wait(10_000)
    r.say('first', false)
    wait(10_000)
    r.say('first second', false)
    wait(SILENCE_MS - 100)
    expect(micStopped()).toBe(false)
    wait(200)
    expect(micStopped()).toBe(true)
    expect(sheetWords()).toBe('first second')
  })

  it('a tap on the microphone listens again after the silence stop and adds to the words', () => {
    const r = openNote()
    r.say('before', true)
    wait(SILENCE_MS + 100)
    expect(micStopped()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Add more' }))
    expect(FakeRecognition.starts()).toBe(2)
    expect(micStopped()).toBe(false)
    FakeRecognition.current().say('after', true)
    expect(sheetWords()).toBe('before after')
  })

  it('stops 3 minutes after listening started even while he keeps talking', () => {
    const r = openNote()
    for (let t = 10; t < 180; t += 10) {
      wait(10_000)
      r.say(`still talking ${t}`, false)
    }
    expect(micStopped()).toBe(false)
    wait(MAX_LISTEN_MS - 170_000 + 100)
    expect(micStopped()).toBe(true)
    expect(sheetWords()).toBe('still talking 170')
    r.endByItself()
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
  })

  it('a restart does not reset the 3-minute limit', () => {
    openNote()
    for (let t = 10; t <= 100; t += 10) {
      wait(10_000)
      FakeRecognition.current().say(`talk ${t}`, false)
    }
    FakeRecognition.current().endByItself()
    wait(1000)
    expect(micStopped()).toBe(false)
    for (let t = 110; t <= 170; t += 10) {
      wait(t === 110 ? 9000 : 10_000)
      FakeRecognition.current().say(`talk ${t}`, false)
    }
    expect(micStopped()).toBe(false)
    wait(MAX_LISTEN_MS - 170_000 + 100)
    expect(micStopped()).toBe(true)
    wait(60_000)
    expect(micStopped()).toBe(true)
  })

  it('tapping stop ends listening, keeps the text, and nothing restarts', () => {
    const { result } = renderHook(() => useRecognition())
    act(() => result.current.start())
    FakeRecognition.current().say('stop here', true)
    expect(result.current.listening).toBe(true)
    act(() => result.current.stop())
    expect(result.current.listening).toBe(false)
    expect(result.current.text).toBe('stop here')
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(result.current.listening).toBe(false)
    expect(result.current.text).toBe('stop here')
  })
})

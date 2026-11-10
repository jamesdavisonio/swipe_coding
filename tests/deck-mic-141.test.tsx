// @vitest-environment jsdom
// deck-mic 141: steady listening. When the browser ends a run by itself (Android after a pause,
// or after a no-speech, aborted or network error) a new run starts within 250 ms, and at no
// moment does the sheet show the stopped state: the button stays "Stop listening", the status
// line stays the listening line, and every word heard since the tap stays grey, in order, once.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  LISTENING_LINE,
  heardNow,
  installRecognition,
  micStatus,
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
const heardText = () => (heardNow()?.textContent ?? '').replace(/\s+/g, ' ').trim()

// The listening state, exactly as James sees it, with these grey words.
const expectListening = (grey: string) => {
  expect(screen.queryByRole('button', { name: 'Stop listening' })).not.toBeNull()
  expect(micStopped()).toBe(false)
  expect(micStatus()).toBe(LISTENING_LINE)
  expect(heardText()).toBe(grey)
}

const endings: [string, (r: FakeRecognition) => void][] = [
  ['the browser ends the run (a pause)', (r) => r.endByItself()],
  ['a no-speech error', (r) => r.fail('no-speech')],
  ['an aborted error', (r) => r.fail('aborted')],
  ['a network error', (r) => r.fail('network')],
]

describe('deck-mic 141: steady listening through restarts', () => {
  it.each(endings)('%s: still listening between the runs, restarted within 250 ms', (_n, end) => {
    const r = openNote()
    r.say('the email should promise a reply', true)
    end(r)
    expectListening('the email should promise a reply')
    wait(100)
    expectListening('the email should promise a reply')
    wait(150)
    expect(FakeRecognition.starts()).toBe(2)
    expectListening('the email should promise a reply')
    FakeRecognition.current().say('and show the address', false)
    expectListening('the email should promise a reply and show the address')
    expect(sheetWords()).toBe('the email should promise a reply and show the address')
  })

  it('holds for any number of restarts, every run once and in order', () => {
    openNote()
    const said: string[] = []
    for (let i = 0; i < 8; i++) {
      const r = FakeRecognition.current()
      r.sayResults([[`part${i}`, false]])
      r.sayResults([[`part${i} said`, true]])
      said.push(`part${i} said`)
      endings[i % endings.length][1](r)
      expectListening(said.join(' '))
      wait(250)
      expect(FakeRecognition.starts()).toBe(i + 2)
      expectListening(said.join(' '))
    }
  })

  it('a restart before anything was said keeps listening with no words', () => {
    openNote().endByItself()
    expect(screen.queryByRole('button', { name: 'Stop listening' })).not.toBeNull()
    expect(micStatus()).toBe(LISTENING_LINE)
    wait(250)
    expect(FakeRecognition.starts()).toBe(2)
    FakeRecognition.current().say('hello', true)
    expectListening('hello')
  })
})

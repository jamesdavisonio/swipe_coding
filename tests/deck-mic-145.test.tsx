// @vitest-environment jsdom
// deck-mic 145: the voice-notes fix is kept in both places (the note sheet and the New session
// idea box): a phrase Android repeats shows once, listening carries on through pauses until
// stopped, 15 s of silence or 3 minutes (a restart resets neither clock), and a tap that stops it
// does not start it again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { MAX_LISTEN_MS, SILENCE_MS } from '../packages/web/src/components/deck/use-recognition.ts'
import { NOW, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  editTextButton,
  installRecognition,
  micStopped,
  sheetBox,
  sheetWords,
  uninstallRecognition,
} from './fixtures/fake-recognition.ts'
import { openSheet, renderDeck } from './fixtures/launch-session-web.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
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

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const listening = () => screen.queryByRole('button', { name: 'Stop listening' }) !== null

// Each place opens already listening and returns the recognizer.
const places: [string, () => FakeRecognition][] = [
  [
    'the note sheet',
    () => {
      renderDeck([specTask()])
      tap('Change it')
      return FakeRecognition.current()
    },
  ],
  [
    'the idea box',
    () => {
      renderDeck([specTask({ projectId: 'p-workshop' })])
      openSheet()
      tap('Start talking')
      return FakeRecognition.current()
    },
  ],
]

describe.each(places)('deck-mic 145 in %s', (_place, listen) => {
  it('a phrase Android repeats shows once, while listening and after', () => {
    const r = listen()
    r.sayResults([
      ["I'll merge", false],
      ["I'll merge your", false],
      ["I'll merge your session", false],
    ])
    expect(sheetWords()).toBe("I'll merge your session")
    r.sayResults([
      ["I'll merge your session", true],
      ["I'll merge your session now", true],
    ])
    expect(sheetWords()).toBe("I'll merge your session now")
    tap('Stop listening')
    expect(sheetBox()?.value).toBe("I'll merge your session now")
  })

  it('carries on through pauses until stopped', () => {
    listen()
    for (let i = 1; i <= 3; i++) {
      FakeRecognition.current().say(`part ${i}`, true)
      FakeRecognition.current().endByItself()
      expect(listening()).toBe(true)
      wait(250)
      expect(FakeRecognition.starts()).toBe(i + 1)
    }
    expect(sheetWords()).toBe('part 1 part 2 part 3')
  })

  it('stops after 15 s of silence, and a restart does not reset that clock', () => {
    const r = listen()
    r.say('hello', true)
    wait(5000)
    r.endByItself()
    wait(1000)
    expect(FakeRecognition.starts()).toBe(2)
    wait(SILENCE_MS - 6000 - 100)
    expect(listening()).toBe(true)
    wait(200)
    expect(micStopped()).toBe(true)
    expect(sheetBox()?.value).toBe('hello')
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(2)
  })

  it('stops 3 minutes after the tap, and a restart does not reset that clock', () => {
    listen()
    for (let t = 10; t <= 100; t += 10) {
      wait(10_000)
      FakeRecognition.current().say(`talk ${t}`, false)
    }
    FakeRecognition.current().endByItself()
    wait(1000)
    expect(listening()).toBe(true)
    for (let t = 110; t <= 170; t += 10) {
      wait(t === 110 ? 9000 : 10_000)
      FakeRecognition.current().say(`talk ${t}`, false)
    }
    expect(listening()).toBe(true)
    wait(MAX_LISTEN_MS - 170_000 + 100)
    expect(micStopped()).toBe(true)
    wait(60_000)
    expect(micStopped()).toBe(true)
  })

  it('a tap on the square does not start it again, even after a late end event', () => {
    const r = listen()
    r.say('stop here', true)
    tap('Stop listening')
    act(() => void r.onend?.())
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(micStopped()).toBe(true)
    expect(sheetBox()?.value).toBe('stop here')
  })

  it('a tap on the text does not start it again', () => {
    const r = listen()
    r.say('stop here', true)
    fireEvent.click(editTextButton() as HTMLElement)
    act(() => void r.onend?.())
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(micStopped()).toBe(true)
  })
})

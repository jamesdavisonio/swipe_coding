// A browser speech recognizer for tests. Install with installRecognition(); then drive it the way
// browsers do: say() delivers one result, sayResults() a whole results list (Android sends several
// results in one event), endByItself() ends the run without James stopping it, fail() is an error.
import { act, screen } from '@testing-library/react'
import { vi } from 'vitest'

export class FakeRecognition extends EventTarget {
  static last: FakeRecognition | null = null
  static all: FakeRecognition[] = []
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  // Browsers end the run after an abort too.
  abort = vi.fn(() => this.onend?.())
  constructor() {
    super()
    FakeRecognition.last = this
    FakeRecognition.all.push(this)
  }
  // The most recently created recognizer (a restart may create a new one).
  static current(): FakeRecognition {
    if (!FakeRecognition.last) throw new Error('no recognizer was created')
    return FakeRecognition.last
  }
  // How many times any recognizer was started: a restart is a second start.
  static starts(): number {
    return FakeRecognition.all.reduce((n, r) => n + r.start.mock.calls.length, 0)
  }
  static reset() {
    FakeRecognition.last = null
    FakeRecognition.all = []
  }
  say(transcript: string, isFinal: boolean) {
    this.sayResults([[transcript, isFinal]])
  }
  sayResults(list: [string, boolean][]) {
    const results = list.map(([transcript, isFinal]) =>
      Object.assign([{ transcript, confidence: 1 }], { isFinal })
    )
    const event = Object.assign(new Event('result'), { resultIndex: 0, results })
    act(() => {
      this.dispatchEvent(event)
      this.onresult?.(event)
    })
  }
  // The browser ends the run (a pause on Android) although nobody stopped it.
  endByItself() {
    act(() => void this.onend?.())
  }
  // An error as Chrome reports it: the error event, then the end of the run.
  fail(error: string) {
    act(() => {
      this.onerror?.({ error })
      this.onend?.()
    })
  }
}

const win = window as unknown as Record<string, unknown>
export function installRecognition() {
  FakeRecognition.reset()
  win.SpeechRecognition = FakeRecognition
}
export function uninstallRecognition() {
  delete win.SpeechRecognition
  delete win.webkitSpeechRecognition
}

// What James sees in the voice sheet: the words (or the placeholder), and whether the microphone
// is listening (the "Record more" button only shows once it has stopped).
export const sheetWords = () =>
  screen.getByRole('dialog').querySelector('[aria-live]')?.textContent ?? ''
export const micStopped = () => screen.queryByRole('button', { name: 'Record more' }) !== null

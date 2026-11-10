// A browser speech recognizer for tests. Install with installRecognition(); then drive it the way
// browsers do: say() delivers one result, sayResults() a whole results list (Android sends several
// results in one event), endByItself() ends the run without James stopping it, fail() is an error.
import { act, screen, within } from '@testing-library/react'
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

// What James sees in the open sheet (the note sheet or the New session sheet): the words, and
// whether the microphone is listening. While it listens the words are the "Stop and edit the
// text" button; otherwise they are the text box ("Your note", or "The idea"). The microphone
// shows "Start talking" or "Add more" only once it has stopped (docs/features/deck-mic.md).
const openDialog = () => screen.getByRole('dialog')
export const editTextButton = () =>
  within(openDialog()).queryByRole('button', { name: 'Stop and edit the text' })
export const sheetBox = () =>
  within(openDialog()).queryByRole<HTMLTextAreaElement>('textbox', {
    name: /^(Your note|The idea)$/,
  })
export const sheetWords = () => {
  const edit = editTextButton()
  if (edit) return (edit.textContent ?? '').trim()
  return sheetBox()?.value ?? ''
}
export const micStopped = () =>
  within(openDialog()).queryByRole('button', { name: /^(Start talking|Add more)$/ }) !== null
// The words heard since the microphone was last tapped (grey italics), or null when there are none.
export const heardNow = () => openDialog().querySelector<HTMLElement>('[data-heard]')
// The status line under the box.
export const micStatus = () =>
  (within(openDialog()).queryByTestId('mic-status')?.textContent ?? '').replace(/\s+/g, ' ').trim()
export const LISTENING_LINE = 'Listening. Tap the text to fix a word.'
export const STOPPED_LINE = 'Tap the text to edit it, or the mic to add more.'
export const EMPTY_LINE = 'Tap the mic and talk.'
// The words before the heard part (outside [data-heard]), and whether any of them is grey or italic.
export function earlierWords(): { text: string; styled: boolean } {
  const root = editTextButton()
  if (!root) return { text: '', styled: false }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let text = ''
  let styled = false
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || el.closest('[data-heard]')) continue
    text += n.textContent ?? ''
    const look = el.closest('.italic, .text-muted-foreground')
    if ((n.textContent ?? '').trim() !== '' && look && root.contains(look)) styled = true
  }
  return { text: text.trim(), styled }
}
// Whether a comes before b in the page (top to bottom, left to right).
export const precedes = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

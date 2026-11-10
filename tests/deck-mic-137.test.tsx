// @vitest-environment jsdom
// deck-mic 137: the microphone button sits left of the send arrow; while listening it is the
// square on the recording colour named "Stop listening", otherwise the microphone named "Start
// talking" (empty box) or "Add more" (text in the box). A tap on "Stop listening" stops listening.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  installRecognition,
  precedes,
  sheetBox,
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
const button = (name: string) => screen.queryByRole('button', { name })
const MIC_NAMES = ['Start talking', 'Add more', 'Stop listening']
// The recording colour is the --rec token (bg-rec, text-rec, border-rec or fill-rec).
const REC_COLOUR = /\b(bg|text|border|fill)-rec\b/
// The icons the button shows: data-icon="square" while listening, "mic" otherwise.
const icons = (b: HTMLElement | null) =>
  Array.from(b?.querySelectorAll('[data-icon]') ?? [], (i) => i.getAttribute('data-icon'))

describe('deck-mic 137: the microphone button', () => {
  it('while listening it is "Stop listening" on the recording colour, left of the arrow', () => {
    openNote()
    const stop = button('Stop listening')
    expect(stop).not.toBeNull()
    expect(stop?.outerHTML).toMatch(REC_COLOUR)
    expect(icons(stop)).toEqual(['square'])
    expect(button('Start talking')).toBeNull()
    expect(button('Add more')).toBeNull()
    expect(precedes(stop as HTMLElement, button('Send') as HTMLElement)).toBe(true)
  })

  it('a tap on "Stop listening" stops listening; with words it becomes "Add more"', () => {
    const r = openNote()
    r.say('make it faster', true)
    fireEvent.click(button('Stop listening') as HTMLElement)
    expect(r.stop.mock.calls.length + r.abort.mock.calls.length).toBeGreaterThan(0)
    expect(button('Stop listening')).toBeNull()
    expect(button('Add more')).not.toBeNull()
    expect(icons(button('Add more'))).toEqual(['mic'])
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(precedes(button('Add more') as HTMLElement, button('Send') as HTMLElement)).toBe(true)
  })

  it('stopped with an empty box it is "Start talking", left of the arrow', () => {
    openNote()
    fireEvent.click(button('Stop listening') as HTMLElement)
    const start = button('Start talking')
    expect(start).not.toBeNull()
    expect(icons(start)).toEqual(['mic'])
    expect(button('Add more')).toBeNull()
    expect(precedes(start as HTMLElement, button('Send') as HTMLElement)).toBe(true)
  })

  it('the name follows the box: typing makes it "Add more", clearing makes it "Start talking"', () => {
    openNote()
    fireEvent.click(button('Stop listening') as HTMLElement)
    fireEvent.change(sheetBox() as HTMLElement, { target: { value: 'typed words' } })
    expect(button('Add more')).not.toBeNull()
    fireEvent.change(sheetBox() as HTMLElement, { target: { value: '' } })
    expect(button('Start talking')).not.toBeNull()
    expect(button('Add more')).toBeNull()
  })

  it('there is one microphone button at a time', () => {
    openNote().say('hello', true)
    const count = () => MIC_NAMES.filter((n) => button(n) !== null).length
    expect(count()).toBe(1)
    fireEvent.click(button('Stop listening') as HTMLElement)
    expect(count()).toBe(1)
  })
})

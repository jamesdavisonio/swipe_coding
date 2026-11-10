// @vitest-environment jsdom
// deck-mic 138: a tap on "Start talking" or "Add more" listens again; the new words follow the text
// in the box (as typed or edited) after one space, and that text never changes or repeats while
// listening.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  installRecognition,
  sheetBox,
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
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const edit = (value: string) => fireEvent.change(sheetBox() as HTMLElement, { target: { value } })
const occurrences = (s: string, part: string) => s.split(part).length - 1

describe('deck-mic 138: listening again adds to the text', () => {
  it('"Start talking" on an empty box listens and its words have no leading space', () => {
    openNote()
    tap('Stop listening')
    tap('Start talking')
    expect(FakeRecognition.starts()).toBe(2)
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    FakeRecognition.current().say('hello there', true)
    tap('Stop listening')
    expect(sheetBox()?.value).toBe('hello there')
  })

  it('"Add more" puts the new words after the edited text, after one space', () => {
    openNote().say('make it faster', true)
    tap('Stop listening')
    edit('make it quicker')
    tap('Add more')
    expect(FakeRecognition.starts()).toBe(2)
    FakeRecognition.current().sayResults([
      ['and', false],
      ['and shorter', false],
    ])
    expect(sheetWords()).toBe('make it quicker and shorter')
    tap('Stop listening')
    expect(sheetBox()?.value).toBe('make it quicker and shorter')
  })

  it('typed text ending in spaces is still followed by exactly one space', () => {
    openNote()
    tap('Stop listening')
    edit('typed first  ')
    tap('Add more')
    FakeRecognition.current().say('then spoken', true)
    tap('Stop listening')
    expect(sheetBox()?.value).toBe('typed first then spoken')
  })

  it('the text before never changes or repeats while listening, through results and a restart', () => {
    openNote()
    tap('Stop listening')
    edit('Keep this.')
    tap('Add more')
    // The earlier text leads, once, at every moment of the listening.
    const kept = () => {
      const words = sheetWords()
      expect(words.startsWith('Keep this. ')).toBe(true)
      expect(occurrences(words, 'Keep this.')).toBe(1)
    }
    const r = FakeRecognition.current()
    r.sayResults([['one', false]])
    kept()
    r.sayResults([
      ['one', true],
      ['one two', false],
    ])
    kept()
    r.endByItself()
    kept()
    wait(250)
    kept()
    FakeRecognition.current().say('three', true)
    kept()
    expect(sheetWords()).toBe('Keep this. one two three')
  })
})

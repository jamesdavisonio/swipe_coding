// @vitest-environment jsdom
// voice-notes 94: a result that repeats the stretch heard so far (Android) shows the words once;
// separate segments (desktop) are still joined in order. Through the voice sheet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  installRecognition,
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

describe('voice-notes 94 repeated results', () => {
  it('shows the words once when each result extends the one before it (one event, Android)', () => {
    const r = openNote()
    r.sayResults([
      ["I'll merge", false],
      ["I'll merge your", false],
      ["I'll merge your session", false],
    ])
    expect(sheetWords()).toBe("I'll merge your session")
  })

  it('shows the words once when the extending results are final or arrive event by event', () => {
    const r = openNote()
    r.sayResults([["I'll merge", false]])
    r.sayResults([
      ["I'll merge", true],
      ["I'll merge your", false],
    ])
    r.sayResults([
      ["I'll merge", true],
      ["I'll merge your", true],
      ["I'll merge your session now", true],
    ])
    expect(sheetWords()).toBe("I'll merge your session now")
  })

  it('compares trimmed transcripts: a leading space does not hide the extension', () => {
    const r = openNote()
    r.sayResults([
      [' hello', false],
      ['hello there', false],
    ])
    expect(sheetWords().trim()).toBe('hello there')
  })

  it('still joins separate segments in order (desktop)', () => {
    const r = openNote()
    r.sayResults([
      ['I merged it', true],
      [' myself', true],
    ])
    expect(sheetWords()).toBe('I merged it myself')
  })

  it('joins a final segment and a following interim one', () => {
    const r = openNote()
    r.sayResults([
      ['I merged it', true],
      [' mysel', false],
    ])
    expect(sheetWords()).toBe('I merged it mysel')
  })

  it('an extended result replaces the one before it but a later separate segment still follows', () => {
    const r = openNote()
    r.sayResults([
      ['a b', true],
      ['a b c', true],
      [' different', true],
    ])
    expect(sheetWords()).toBe('a b c different')
  })
})

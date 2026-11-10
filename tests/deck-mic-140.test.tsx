// @vitest-environment jsdom
// deck-mic 140: a status line (data-testid="mic-status", aria-live="polite") between the box and
// the buttons: the listening line while listening, the edit-or-add line when stopped with text,
// the talk line when empty.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  EMPTY_LINE,
  FakeRecognition,
  LISTENING_LINE,
  STOPPED_LINE,
  editTextButton,
  installRecognition,
  micStatus,
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
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const statusLine = () => within(screen.getByRole('dialog')).getByTestId('mic-status')

describe('deck-mic 140: the status line', () => {
  it('is a polite live region, not a status role', () => {
    openNote()
    expect(statusLine().getAttribute('aria-live')).toBe('polite')
    expect(statusLine().getAttribute('role')).not.toBe('status')
  })

  it('reads the listening line while listening, sits under the text and above the buttons', () => {
    openNote().say('some words', false)
    expect(micStatus()).toBe(LISTENING_LINE)
    expect(precedes(editTextButton() as HTMLElement, statusLine())).toBe(true)
    expect(precedes(statusLine(), screen.getByRole('button', { name: 'Stop listening' }))).toBe(
      true
    )
    expect(precedes(statusLine(), screen.getByRole('button', { name: 'Send' }))).toBe(true)
    // The moving bars: aria-hidden [data-slot="rec-bar"], in the sheet only while listening.
    const bars = () => screen.getByRole('dialog').querySelectorAll('[data-slot="rec-bar"]')
    expect(bars().length).toBeGreaterThan(0)
    for (const bar of bars()) expect(bar.closest('[aria-hidden="true"]')).not.toBeNull()
    tap('Stop listening')
    expect(bars().length).toBe(0)
  })

  it('reads the edit-or-add line when stopped with text, under the box', () => {
    openNote().say('some words', true)
    tap('Stop listening')
    expect(micStatus()).toBe(STOPPED_LINE)
    expect(precedes(sheetBox() as HTMLElement, statusLine())).toBe(true)
    expect(precedes(statusLine(), screen.getByRole('button', { name: 'Add more' }))).toBe(true)
  })

  it('reads the talk line when the box is empty, and follows typing', () => {
    openNote()
    tap('Stop listening')
    expect(micStatus()).toBe(EMPTY_LINE)
    fireEvent.change(sheetBox() as HTMLElement, { target: { value: 'typed' } })
    expect(micStatus()).toBe(STOPPED_LINE)
    fireEvent.change(sheetBox() as HTMLElement, { target: { value: '' } })
    expect(micStatus()).toBe(EMPTY_LINE)
  })

  it('goes back to the listening line on "Add more"', () => {
    openNote().say('some words', true)
    tap('Stop listening')
    tap('Add more')
    expect(micStatus()).toBe(LISTENING_LINE)
  })
})

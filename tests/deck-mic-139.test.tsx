// @vitest-environment jsdom
// deck-mic 139: while listening the text is one button, "Stop and edit the text"; a tap stops
// listening and turns it into the editable box holding all the words, focused with the caret at
// the end. When not listening the box is editable and what James types is what is sent or added to.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { actions, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  editTextButton,
  installRecognition,
  micStopped,
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
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const edit = (value: string) => fireEvent.change(sheetBox() as HTMLElement, { target: { value } })

describe('deck-mic 139: tap the text to stop and edit', () => {
  it('while listening the words are one button and there is no text box', () => {
    openNote().say('promise a reply within one business day', false)
    const text = editTextButton()
    expect(text).not.toBeNull()
    expect(text?.textContent).toContain('promise a reply within one business day')
    expect(sheetBox()).toBeNull()
  })

  it('a tap on the text stops listening and focuses the box with the caret at the end', () => {
    const r = openNote()
    r.say('one business day', true)
    fireEvent.click(editTextButton() as HTMLElement)
    expect(r.stop.mock.calls.length + r.abort.mock.calls.length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Stop listening' })).toBeNull()
    expect(micStopped()).toBe(true)
    const box = sheetBox() as HTMLTextAreaElement
    expect(box.value).toBe('one business day')
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe(box.value.length)
    expect(box.selectionEnd).toBe(box.value.length)
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
  })

  it('the box holds the grey words and the earlier ones together', () => {
    openNote().say('first part', true)
    tap('Stop listening')
    tap('Add more')
    FakeRecognition.current().say('second part', false)
    fireEvent.click(editTextButton() as HTMLElement)
    expect(sheetBox()?.value).toBe('first part second part')
    expect(document.activeElement).toBe(sheetBox())
  })

  it('a tap on the text with nothing said yet opens an empty, focused box', () => {
    openNote()
    fireEvent.click(editTextButton() as HTMLElement)
    expect(sheetBox()?.value).toBe('')
    expect(document.activeElement).toBe(sheetBox())
    expect(screen.getByRole('button', { name: 'Start talking' })).toBeTruthy()
  })

  it('what James types is what is sent', () => {
    openNote().say('one business day', true)
    fireEvent.click(editTextButton() as HTMLElement)
    edit('one working day')
    tap('Send')
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec1' }),
      'one working day'
    )
  })

  it('deleting everything empties the note: more words start afresh', () => {
    openNote().say('wrong words', true)
    tap('Stop listening')
    edit('')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(true)
    tap('Start talking')
    FakeRecognition.current().say('right words', true)
    tap('Stop listening')
    expect(sheetBox()?.value).toBe('right words')
  })
})

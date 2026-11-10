// @vitest-environment jsdom
// deck-mic 142: the send arrow is disabled while there are no words; tapped while listening it
// stops listening and sends every word, grey ones included. Closing the sheet throws the words
// away.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { actions, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
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
const send = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Send' })

describe('deck-mic 142: sending and closing', () => {
  it('the arrow is disabled while listening with no words, and once words come it is not', () => {
    openNote()
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    expect(send().disabled).toBe(true)
    FakeRecognition.current().say('words', false)
    expect(send().disabled).toBe(false)
  })

  it('the arrow is disabled when stopped with an empty box', () => {
    openNote()
    tap('Stop listening')
    expect(send().disabled).toBe(true)
  })

  it('tapped while listening it stops listening and sends every word, grey ones included', () => {
    openNote().say('make it faster', true)
    tap('Stop listening')
    tap('Add more')
    const r = FakeRecognition.current()
    r.say('and shorter', false)
    fireEvent.click(send())
    expect(actions.sendNote).toHaveBeenCalledTimes(1)
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec1' }),
      'make it faster and shorter'
    )
    expect(r.stop.mock.calls.length + r.abort.mock.calls.length).toBeGreaterThan(0)
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(2)
  })

  it('closing throws the words away, edited ones too', () => {
    openNote().say('throw this away', true)
    tap('Stop listening')
    fireEvent.change(sheetBox() as HTMLElement, { target: { value: 'and this edit' } })
    tap('Close')
    expect(screen.queryByRole('dialog')).toBeNull()
    tap('Change it')
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    expect(sheetWords()).not.toContain('throw this away')
    expect(sheetWords()).not.toContain('and this edit')
  })
})

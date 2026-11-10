// @vitest-environment jsdom
// deck-mic 136: while listening, the words heard since the microphone was last tapped are grey
// italics ([data-heard], italic, text-muted-foreground) after the earlier words, which are not;
// once listening stops (tap, 15 s of silence, the 3-minute cap) every word is plain, none lost or
// repeated.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { MAX_LISTEN_MS, SILENCE_MS } from '../packages/web/src/components/deck/use-recognition.ts'
import { renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  earlierWords,
  heardNow,
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
const heardText = () => (heardNow()?.textContent ?? '').trim()

describe('deck-mic 136: heard words in grey italics while listening', () => {
  it('the words heard so far are in the grey italic part', () => {
    openNote().say('make it faster', false)
    const heard = heardNow()
    expect(heard).not.toBeNull()
    expect(heard?.classList.contains('italic')).toBe(true)
    expect(heard?.classList.contains('text-muted-foreground')).toBe(true)
    expect(heardText()).toBe('make it faster')
  })

  it('after a tap on the microphone only the new words are grey; the earlier ones are plain', () => {
    openNote().say('make it faster', true)
    tap('Stop listening')
    tap('Add more')
    FakeRecognition.current().say('and shorter', false)
    expect(heardText()).toBe('and shorter')
    expect(earlierWords()).toEqual({ text: 'make it faster', styled: false })
  })

  it('a tap on the square makes every word plain, each once', () => {
    openNote().sayResults([
      ['a b', false],
      ['a b c', false],
    ])
    tap('Stop listening')
    tap('Add more')
    FakeRecognition.current().say('d e', true)
    tap('Stop listening')
    expect(heardNow()).toBeNull()
    expect(sheetBox()?.value).toBe('a b c d e')
  })

  it('15 s of silence makes every word plain, none lost', () => {
    openNote().say('keep these words', true)
    wait(SILENCE_MS + 100)
    expect(micStopped()).toBe(true)
    expect(heardNow()).toBeNull()
    expect(sheetBox()?.value).toBe('keep these words')
  })

  it('the 3-minute cap makes every word plain, none lost', () => {
    const r = openNote()
    for (let t = 10; t < 180; t += 10) {
      wait(10_000)
      r.say(`still talking ${t}`, false)
    }
    wait(MAX_LISTEN_MS - 170_000 + 100)
    expect(micStopped()).toBe(true)
    expect(heardNow()).toBeNull()
    expect(sheetBox()?.value).toBe('still talking 170')
  })
})

// @vitest-environment jsdom
// deck-mic review (criteria 136 and 139): Chrome's stop() does not end the run at once; it later
// delivers a final result for the audio heard so far, then the end. That late result must not add
// the words again, undo an edit or a clear, or disturb a listening James started again at once.
// In the note sheet and in the New session idea box. The recognizer's stop is made Chrome-like
// here, in the test, without changing the shared fake.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { NOW, actions, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  editTextButton,
  installRecognition,
  sheetBox,
  sheetWords,
  uninstallRecognition,
} from './fixtures/fake-recognition.ts'
import {
  createTask,
  openSheet,
  renderDeck,
  startButton,
  typeName,
} from './fixtures/launch-session-web.tsx'

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
const flush = () => act(async () => void (await Promise.resolve()))
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
// Before the stop the run has only an interim stretch; Chrome's late final result finalises it
// with different words. Either may stand in the box, but "make it" only once.
const INTERIM = 'make it fast'
const LATE = 'make it faster'
const once = (text: string) => text.split('make it').length - 1

// Like Chrome: stop and abort return at once and the run ends later, on its own.
const chromeLike = (r: FakeRecognition) => {
  r.stop.mockImplementation(() => {})
  r.abort.mockImplementation(() => {})
  return r
}

type Place = {
  // Opens the place listening, with INTERIM heard, and returns the (Chrome-like) recognizer.
  listen: () => FakeRecognition
  // Sends or submits what is in the box and returns the text that went out.
  submit: () => Promise<string>
}
const places: [string, Place][] = [
  [
    'the note sheet',
    {
      listen: () => {
        renderDeck([specTask()])
        tap('Change it')
        const r = chromeLike(FakeRecognition.current())
        r.say(INTERIM, false)
        return r
      },
      submit: async () => {
        fireEvent.change(sheetBox() as HTMLElement, { target: { value: 'fresh words' } })
        tap('Send')
        await flush()
        expect(actions.sendNote).toHaveBeenCalledTimes(1)
        return actions.sendNote.mock.calls[0][1]
      },
    },
  ],
  [
    'the idea box',
    {
      listen: () => {
        renderDeck([specTask({ projectId: 'p-workshop' })])
        openSheet()
        typeName('Search page')
        tap('Start talking')
        const r = chromeLike(FakeRecognition.current())
        r.say(INTERIM, false)
        return r
      },
      submit: async () => {
        fireEvent.click(startButton())
        await flush()
        expect(createTask).toHaveBeenCalledTimes(1)
        return (createTask.mock.calls[0][1] as { description: string }).description
      },
    },
  ],
]

describe.each(places)('deck-mic review in %s: the late final result after a stop', (_n, place) => {
  it('a tap on the square, then the late result: the box holds the words once', () => {
    const r = place.listen()
    tap('Stop listening')
    r.say(LATE, true)
    expect(once(sheetBox()?.value ?? '')).toBe(1)
    r.endByItself()
    wait(1000)
    expect(once(sheetBox()?.value ?? '')).toBe(1)
    expect(FakeRecognition.starts()).toBe(1)
  })

  it('a tap on the text, then the late result: the box holds the words once', () => {
    const r = place.listen()
    fireEvent.click(editTextButton() as HTMLElement)
    r.say(LATE, true)
    expect(once(sheetBox()?.value ?? '')).toBe(1)
    r.endByItself()
    wait(1000)
    expect(once(sheetBox()?.value ?? '')).toBe(1)
    expect(FakeRecognition.starts()).toBe(1)
  })

  it('a box cleared after the late result stays clear, and none of the old words go out', async () => {
    const r = place.listen()
    tap('Stop listening')
    r.say(LATE, true)
    fireEvent.change(sheetBox() as HTMLElement, { target: { value: '' } })
    r.endByItself()
    wait(1000)
    expect(sheetBox()?.value).toBe('')
    expect(screen.getByRole('button', { name: 'Start talking' })).toBeTruthy()
    const sent = await place.submit()
    expect(once(sent)).toBe(0)
    expect(sent).not.toContain('fast')
    expect(FakeRecognition.starts()).toBe(1)
  })

  it('"Add more" right after the square listens at once; the old run’s late result changes nothing', () => {
    const r = place.listen()
    tap('Stop listening')
    tap('Add more')
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    expect(FakeRecognition.starts()).toBe(2)
    const next = FakeRecognition.current()
    expect(next).not.toBe(r)
    next.say('and shorter', true)
    const words = () => {
      expect(once(sheetWords())).toBe(1)
      expect(sheetWords().endsWith(' and shorter')).toBe(true)
    }
    words()
    r.say(LATE, true)
    words()
    r.endByItself()
    wait(100)
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    expect(FakeRecognition.starts()).toBe(2)
    words()
    tap('Stop listening')
    expect(once(sheetBox()?.value ?? '')).toBe(1)
    expect(sheetBox()?.value.endsWith(' and shorter')).toBe(true)
  })
})

// @vitest-environment jsdom
// deck-mic 144: the New session idea box has the same microphone: a round button under the box at
// its left (named as in 137), grey italic heard words (136), the status line (140), tap the text
// to stop and edit (139), tap the mic to add (138) and steady listening (141). No send arrow:
// "Start session" stops listening and uses every word. Without recognition, or refused, a plain
// text box.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { NOW, specTask } from './fixtures/web-threads-b2.tsx'
import {
  EMPTY_LINE,
  FakeRecognition,
  LISTENING_LINE,
  STOPPED_LINE,
  earlierWords,
  editTextButton,
  heardNow,
  installRecognition,
  micStatus,
  precedes,
  sheetBox,
  sheetWords,
  uninstallRecognition,
} from './fixtures/fake-recognition.ts'
import {
  createTask,
  ideaField,
  openSheet,
  renderDeck,
  startButton,
  typeIdea,
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
const button = (name: string) => screen.queryByRole('button', { name })
const heardText = () => (heardNow()?.textContent ?? '').replace(/\s+/g, ' ').trim()
const open = () => {
  renderDeck([specTask({ projectId: 'p-workshop' })])
  return openSheet()
}
const REC_COLOUR = /\b(bg|text|border|fill)-rec\b/

describe('deck-mic 144: the idea box microphone', () => {
  it('a round "Start talking" button under the box, the talk line, and no send arrow', () => {
    const sheet = open()
    const start = button('Start talking') as HTMLElement
    expect(start).not.toBeNull()
    expect(precedes(ideaField(), start)).toBe(true)
    expect(precedes(start, startButton())).toBe(true)
    expect(micStatus()).toBe(EMPTY_LINE)
    expect(within(sheet).queryByRole('button', { name: 'Send' })).toBeNull()
    typeIdea('Add a search page.')
    expect(button('Add more')).not.toBeNull()
    expect(micStatus()).toBe(STOPPED_LINE)
  })

  it('listening: the square, the listening line, the text as a button, new words grey after the typed ones', () => {
    open()
    typeIdea('Add a search page.')
    tap('Add more')
    expect(button('Stop listening')?.outerHTML).toMatch(REC_COLOUR)
    expect(micStatus()).toBe(LISTENING_LINE)
    expect(sheetBox()).toBeNull()
    FakeRecognition.current().say('It should be fast', false)
    const heard = heardNow()
    expect(heard?.classList.contains('italic')).toBe(true)
    expect(heard?.classList.contains('text-muted-foreground')).toBe(true)
    expect(heardText()).toBe('It should be fast')
    expect(earlierWords()).toEqual({ text: 'Add a search page.', styled: false })
    expect(sheetWords()).toBe('Add a search page. It should be fast')
  })

  it('a tap on the square stops: all words plain in the box, "Add more"', () => {
    open()
    tap('Start talking')
    const r = FakeRecognition.current()
    r.say('search by title', true)
    tap('Stop listening')
    expect(r.stop.mock.calls.length + r.abort.mock.calls.length).toBeGreaterThan(0)
    expect(heardNow()).toBeNull()
    expect(ideaField().value).toBe('search by title')
    expect(button('Add more')).not.toBeNull()
    expect(micStatus()).toBe(STOPPED_LINE)
  })

  it('a tap on the text stops and focuses the box with the caret at the end', () => {
    open()
    tap('Start talking')
    FakeRecognition.current().say('search by title', false)
    fireEvent.click(editTextButton() as HTMLElement)
    const box = ideaField()
    expect(box.value).toBe('search by title')
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe(box.value.length)
    expect(button('Stop listening')).toBeNull()
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
  })

  it('"Add more" adds after the edited text with one space', () => {
    open()
    tap('Start talking')
    FakeRecognition.current().say('search by titel', true)
    tap('Stop listening')
    typeIdea('search by title')
    tap('Add more')
    FakeRecognition.current().say('and by project', true)
    tap('Stop listening')
    expect(ideaField().value).toBe('search by title and by project')
  })

  it.each([
    ['a pause', (r: FakeRecognition) => r.endByItself()],
    ['a no-speech error', (r: FakeRecognition) => r.fail('no-speech')],
    ['an aborted error', (r: FakeRecognition) => r.fail('aborted')],
    ['a network error', (r: FakeRecognition) => r.fail('network')],
  ])('steady through %s: never shows stopped, restarts within 250 ms', (_n, end) => {
    open()
    tap('Start talking')
    const r = FakeRecognition.current()
    r.say('search by title', true)
    end(r)
    for (const step of [0, 100, 150]) {
      wait(step)
      expect(button('Stop listening')).not.toBeNull()
      expect(micStatus()).toBe(LISTENING_LINE)
      expect(heardText()).toBe('search by title')
    }
    expect(FakeRecognition.starts()).toBe(2)
    FakeRecognition.current().say('and project', false)
    expect(heardText()).toBe('search by title and project')
  })

  it('steady through several restarts in a row, every run grey, once and in order', () => {
    open()
    tap('Start talking')
    const ends = ['', 'no-speech', 'aborted', 'network', '', 'no-speech']
    const said: string[] = []
    ends.forEach((error, i) => {
      const r = FakeRecognition.current()
      r.say(`part${i}`, true)
      said.push(`part${i}`)
      if (error === '') r.endByItself()
      else r.fail(error)
      for (const step of [0, 250]) {
        wait(step)
        expect(button('Stop listening')).not.toBeNull()
        expect(micStatus()).toBe(LISTENING_LINE)
        expect(heardText()).toBe(said.join(' '))
      }
      expect(FakeRecognition.starts()).toBe(i + 2)
    })
  })

  it('"Start session" while listening stops it and uses every word, grey ones included', async () => {
    open()
    typeName('Search page')
    tap('Start talking')
    FakeRecognition.current().say('search by title', true)
    tap('Stop listening')
    tap('Add more')
    const r = FakeRecognition.current()
    r.say('and by project', false)
    fireEvent.click(startButton())
    await flush()
    expect(r.stop.mock.calls.length + r.abort.mock.calls.length).toBeGreaterThan(0)
    expect(createTask).toHaveBeenCalledWith(
      'p-workshop',
      expect.objectContaining({ description: 'search by title and by project' })
    )
  })

  it('without speech recognition the idea is a plain text box', () => {
    uninstallRecognition()
    const sheet = open()
    expect(ideaField()).toBeTruthy()
    for (const name of ['Start talking', 'Add more', 'Stop listening']) {
      expect(within(sheet).queryByRole('button', { name })).toBeNull()
    }
    expect(within(sheet).queryByTestId('mic-status')).toBeNull()
  })

  it('a refused microphone leaves a plain text box with the words heard before', () => {
    const sheet = open()
    tap('Start talking')
    const r = FakeRecognition.current()
    r.say('search by title', true)
    r.fail('not-allowed')
    expect(ideaField().value).toBe('search by title')
    for (const name of ['Start talking', 'Add more', 'Stop listening']) {
      expect(within(sheet).queryByRole('button', { name })).toBeNull()
    }
    expect(heardNow()).toBeNull()
  })
})

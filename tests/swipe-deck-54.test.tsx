// @vitest-environment jsdom
// swipe-deck 54 (UI side): the microphone records through speech recognition, shows the words as
// they come, the arrow sends them; the card leaves and a line says the deck waits for that
// session's revised card until the task waits again or ten minutes pass. Without recognition the
// microphone falls back to a text box. (What each note writes is the data layer's.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  MINUTE,
  NOW,
  actions,
  board,
  deployTask,
  fixTask,
  live,
  mergeTask,
  nextTask,
  pageText,
  press,
  renderAt,
  setBoard,
  specTask,
  summaryTask,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

// A browser speech recognizer: tests call say() the way the browser delivers results.
class FakeRecognition extends EventTarget {
  static last: FakeRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()
  constructor() {
    super()
    FakeRecognition.last = this
  }
  say(transcript: string, isFinal: boolean) {
    const results = [Object.assign([{ transcript, confidence: 1 }], { isFinal })]
    const event = Object.assign(new Event('result'), { resultIndex: 0, results })
    act(() => {
      this.dispatchEvent(event)
      this.onresult?.(event)
    })
  }
}

const win = window as unknown as Record<string, unknown>
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  FakeRecognition.last = null
  win.SpeechRecognition = FakeRecognition
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete win.SpeechRecognition
  delete win.webkitSpeechRecognition
})

const speakNote = (words: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
  expect(FakeRecognition.last?.start).toHaveBeenCalled()
  FakeRecognition.last!.say(words, true)
}
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send' }))

describe('swipe-deck 54 recording', () => {
  it('shows interim words as they come and sends the final words with the arrow', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    FakeRecognition.last!.say('make it fas', false)
    expect(screen.getByRole('dialog').textContent).toContain('make it fas')
    FakeRecognition.last!.say('make it faster', true)
    expect(screen.getByRole('dialog').textContent).toContain('make it faster')
    expect(actions.sendNote).not.toHaveBeenCalled()
    send()
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec1' }),
      'make it faster'
    )
  })

  it('works through the webkit-prefixed recognizer, and M starts it', () => {
    delete win.SpeechRecognition
    win.webkitSpeechRecognition = FakeRecognition
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    press('m')
    expect(FakeRecognition.last?.start).toHaveBeenCalled()
  })

  it.each([
    ['spec', specTask(), 'spec1'],
    ['question', fixTask(), 'fix1'],
    ['merge', mergeTask(), 'merge1'],
    ['after_deploy', deployTask(), 'deploy1'],
    ['summary', summaryTask(), 'sum1'],
  ])('a %s note goes to sendNote for that task', (_n, task, taskId) => {
    setBoard({ tasks: [task] })
    renderAt('/', <Deck />)
    speakNote('please change this')
    send()
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId }),
      'please change this'
    )
  })

  it('a next note queues the task with the note as its description', () => {
    setBoard({ tasks: [nextTask()] })
    renderAt('/', <Deck />)
    speakNote('but only the header')
    send()
    expect(actions.queueSuggestion).toHaveBeenCalledWith(
      'p-kanban',
      'Add dark mode',
      'but only the header'
    )
    expect(actions.sendNote).not.toHaveBeenCalled()
  })
})

describe('swipe-deck 54 waiting for the revised card', () => {
  const ui = () => (
    <MemoryRouter>
      <Deck />
    </MemoryRouter>
  )
  const noted = () => {
    setBoard({ tasks: [specTask()] })
    const view = render(ui())
    speakNote('shorter please')
    send()
    return view
  }

  it('the card leaves and a line names the session it waits for', () => {
    noted()
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(pageText()).toMatch(/waiting for/i)
    expect(pageText()).toContain('Order the replies')
  })

  it('the revised card replaces the line when the task waits on James again', () => {
    const view = noted()
    board.tasks = live([specTask({ needs: null, updatedAt: NOW + MINUTE })])
    view.rerender(ui())
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(pageText()).toMatch(/waiting for/i)
    board.tasks = live([specTask({ updatedAt: NOW + 2 * MINUTE })])
    view.rerender(ui())
    expect(screen.getByTestId('deck-card').textContent).toContain('Order the replies')
    expect(pageText()).not.toMatch(/waiting for/i)
  })

  it('stops waiting after ten minutes', () => {
    noted()
    act(() => void vi.advanceTimersByTime(9 * MINUTE))
    expect(screen.queryByTestId('deck-card')).toBeNull()
    act(() => void vi.advanceTimersByTime(2 * MINUTE))
    expect(pageText()).not.toMatch(/waiting for/i)
    expect(screen.getByTestId('deck-card')).toBeTruthy()
  })
})

describe('swipe-deck 54 without speech recognition', () => {
  it('Change it opens a text box with the same Send arrow', () => {
    delete win.SpeechRecognition
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    const box = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(box, { target: { value: 'typed change' } })
    send()
    expect(actions.sendNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec1' }),
      'typed change'
    )
  })
})

// @vitest-environment jsdom
// swipe-deck 53: every move has a named control and a key; the card type is a word as well as a
// colour. (44px targets, focus ring and token colours are layout/CSS and are not observable in jsdom.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  actions,
  deployTask,
  KIND_LABEL_TEXT,
  installClock,
  makeTodo,
  mergeTask,
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

const speak = vi.fn()
beforeEach(() => {
  localStorage.clear()
  speak.mockClear()
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak, cancel: vi.fn(), getVoices: () => [] },
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      constructor(text = '') {
        this.text = text
      }
    }
  )
})
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).speechSynthesis
  vi.unstubAllGlobals()
})

describe('swipe-deck 53 named controls', () => {
  installClock()

  it.each(['Later', 'Agree', 'Details', 'Overview', 'Change it', 'Listen'])(
    'has a button named %s',
    (name) => {
      setBoard({ tasks: [specTask()] })
      renderAt('/', <Deck />)
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  )

  it('Agree acts, Later brings the next card up, Listen speaks, Change it opens the voice sheet', async () => {
    setBoard({
      tasks: [
        specTask({ title: 'First spec' }),
        specTask({ id: 's2', title: 'Second spec', updatedAt: Date.now() }),
      ],
    })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.getByTestId('deck-card').textContent).toContain('Second spec')
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))
    await vi.waitFor(() =>
      expect(actions.approveSpec).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }))
    )
  })

  it('M opens the voice sheet, L reads the card aloud, arrows open the sheets', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    press('m')
    expect(screen.getByRole('dialog')).toBeTruthy()
    press('Escape')
    press('l')
    expect(speak).toHaveBeenCalledTimes(1)
    press('ArrowUp')
    expect(screen.getByRole('dialog')).toBeTruthy()
    press('Escape')
    press('ArrowDown')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it.each([
    ['spec', () => specTask(), KIND_LABEL_TEXT.spec],
    ['merge', () => mergeTask(), KIND_LABEL_TEXT.merge],
    ['after deploy', () => deployTask(), KIND_LABEL_TEXT.after_deploy],
    ['done', () => summaryTask(), KIND_LABEL_TEXT.summary],
  ])('writes the %s card type as a word', (_n, task, word) => {
    setBoard({ tasks: [task()] })
    renderAt('/', <Deck />)
    expect(screen.getByTestId('deck-type').textContent).toBe(word)
  })

  it('writes the to-do card type as a word', () => {
    setBoard({ todos: [makeTodo('a')] })
    renderAt('/', <Deck />)
    expect(screen.getByTestId('deck-type').textContent).toBe(KIND_LABEL_TEXT.todos)
  })
})

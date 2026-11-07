// @vitest-environment jsdom
// swipe-deck 55: the speaker reads the card aloud (origin, headline, example, brief parts) with
// speech synthesis; without synthesis the speaker is hidden.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  DECK_EXAMPLE,
  DECK_PARTS,
  fixTask,
  installClock,
  press,
  renderAt,
  setBoard,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const spoken: string[] = []
const win = window as unknown as Record<string, unknown>
const withSynthesis = () => {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak: vi.fn((u: { text: string }) => void spoken.push(u.text)),
      cancel: vi.fn(),
      getVoices: () => [],
    },
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
}

beforeEach(() => {
  localStorage.clear()
  spoken.length = 0
})
afterEach(() => {
  delete win.speechSynthesis
  vi.unstubAllGlobals()
})

describe('swipe-deck 55 listen', () => {
  installClock()

  it('reads where it came from, the headline, the example and the parts', () => {
    withSynthesis()
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
    expect(spoken).toHaveLength(1)
    const said = spoken[0]
    const order = [
      'Mend the export',
      DECK_EXAMPLE,
      DECK_PARTS.origin,
      DECK_PARTS.why,
      DECK_PARTS.assumptions,
      DECK_PARTS.out,
      DECK_PARTS.agreeing,
    ].map((s) => said.indexOf(s))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(said).toContain('kanban')
    expect(said).not.toMatch(/[#*`]/)
  })

  it('L reads it too', () => {
    withSynthesis()
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    press('l')
    expect(spoken).toHaveLength(1)
  })

  it('hides the speaker without speech synthesis, and the microphone falls back to a text box', () => {
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    expect(screen.queryByRole('button', { name: 'Listen' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})

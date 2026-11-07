// @vitest-environment jsdom
// swipe-deck 50: a card with choices opens a sheet of them; an important card opens a sheet whose
// button must be held for 3 seconds; nothing is typed anywhere.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { HOLD_MS } from '../packages/web/src/components/deck/HoldButton.tsx'
import {
  NOW,
  actions,
  choiceTask,
  mergeTask,
  pointer,
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

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const sheet = () => screen.getByRole('dialog')

describe('swipe-deck 50 choices sheet', () => {
  it('opens on Agree with the choices, recommended (the first) first', () => {
    setBoard({ tasks: [choiceTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    const buttons = within(sheet())
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
    const serif = buttons.findIndex((t) => t.includes('Serif'))
    const sans = buttons.findIndex((t) => t.includes('Sans'))
    expect(serif).toBeGreaterThanOrEqual(0)
    expect(serif).toBeLessThan(sans)
    expect(actions.answerQuestion).not.toHaveBeenCalled()
  })

  it('tapping a choice answers with it', async () => {
    setBoard({ tasks: [choiceTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    fireEvent.click(within(sheet()).getByRole('button', { name: /Sans/ }))
    await waitFor(() =>
      expect(actions.answerQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'choice1' }),
        expect.objectContaining({ label: 'Sans' })
      )
    )
  })

  it('closing the sheet leaves the card and answers nothing', () => {
    setBoard({ tasks: [choiceTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('deck-card').textContent).toContain('Which font?')
    expect(actions.answerQuestion).not.toHaveBeenCalled()
  })
})

describe('swipe-deck 50 hold to merge', () => {
  const open = () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    return screen.getByRole('button', { name: 'Hold to confirm' })
  }
  const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('holds for 3 seconds', () => {
    expect(HOLD_MS).toBe(3000)
  })

  it('letting go early sends nothing and says to keep holding', () => {
    const hold = open()
    expect(actions.requestMerge).not.toHaveBeenCalled()
    pointer(hold, 'pointerdown')
    wait(HOLD_MS - 500)
    pointer(hold, 'pointerup')
    wait(2 * HOLD_MS)
    expect(actions.requestMerge).not.toHaveBeenCalled()
    expect(sheet().textContent).toMatch(/keep holding/i)
  })

  it('the full hold asks the session to merge, once', async () => {
    const hold = open()
    pointer(hold, 'pointerdown')
    wait(HOLD_MS + 50)
    pointer(hold, 'pointerup')
    await vi.waitFor(() =>
      expect(actions.requestMerge).toHaveBeenCalledWith(expect.objectContaining({ id: 'merge1' }))
    )
    expect(actions.requestMerge).toHaveBeenCalledTimes(1)
  })

  it('has nothing to type in', () => {
    open()
    expect(within(sheet()).queryByRole('textbox')).toBeNull()
  })
})

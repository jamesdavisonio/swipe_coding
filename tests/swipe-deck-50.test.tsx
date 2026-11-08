// @vitest-environment jsdom
// swipe-deck 50: a card with choices opens a sheet of them; nothing is typed anywhere. (The merge
// half, a sheet whose button is held 3 seconds, is superseded by merge-on-github 89-93.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { NOW, actions, choiceTask, press, renderAt, setBoard } from './fixtures/web-threads-b2.tsx'

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
    await vi.waitFor(() =>
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

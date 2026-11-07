// @vitest-environment jsdom
// swipe-deck 62: a next card dragged left, ArrowLeft or Later opens the skip sheet: Skip for now
// passes the card, Never show again drops it, Close leaves it. The left stamp reads "Skip".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  actions,
  installClock,
  nextTask,
  pageText,
  press,
  renderAt,
  setBoard,
  swipe,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const card = () => screen.getByTestId('deck-card')
const shown = () => (card().textContent ?? '').replace(/\s+/g, ' ')
const skipSheet = () => screen.getByRole('dialog', { name: 'Skip this suggestion?' })
const answer = (name: string) => fireEvent.click(within(skipSheet()).getByRole('button', { name }))
const two = () =>
  setBoard({
    tasks: [nextTask({ summary: 'Done.\n\n### Suggested next\nAdd dark mode — why\nFix links' })],
  })

describe('swipe-deck 62 skip sheet', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it.each([
    ['a left drag', () => swipe(card(), -300)],
    ['ArrowLeft', () => press('ArrowLeft')],
    ['Later', () => fireEvent.click(screen.getByRole('button', { name: 'Later' }))],
  ])('%s opens it with both answers and the card still there', (_n, go) => {
    two()
    renderAt('/', <Deck />)
    go()
    const sheet = skipSheet()
    expect(within(sheet).getByRole('button', { name: 'Skip for now' })).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: 'Never show again' })).toBeTruthy()
    expect(shown()).toContain('Add dark mode')
  })

  it('Skip for now passes the card behind the others, remembered across a reload', () => {
    two()
    const view = renderAt('/', <Deck />)
    press('ArrowLeft')
    answer('Skip for now')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(shown()).toContain('Fix links')
    view.unmount()
    renderAt('/', <Deck />)
    expect(shown()).toContain('Fix links')
    expect(pageText()).toContain('Add dark mode')
  })

  it('Never show again drops it from this phone for good', () => {
    two()
    const view = renderAt('/', <Deck />)
    press('ArrowLeft')
    answer('Never show again')
    expect(shown()).toContain('Fix links')
    view.unmount()
    renderAt('/', <Deck />)
    expect(pageText()).not.toContain('Add dark mode')
  })

  it('Close leaves the card on top', () => {
    two()
    renderAt('/', <Deck />)
    press('ArrowLeft')
    answer('Close')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(shown()).toContain('Add dark mode')
  })

  it('writes nothing to the board whichever answer is chosen', () => {
    two()
    renderAt('/', <Deck />)
    press('ArrowLeft')
    answer('Skip for now')
    press('ArrowLeft')
    answer('Never show again')
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled()
  })

  it('the left stamp on a next card reads Skip', () => {
    two()
    renderAt('/', <Deck />)
    swipe(card(), -300, 0, true)
    expect(screen.getByTestId('deck-stamp-later').textContent).toContain('Skip')
  })
})

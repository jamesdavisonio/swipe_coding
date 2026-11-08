// @vitest-environment jsdom
// merge-on-github 93: no action on any card asks a session to merge, and the 3-second hold sheet is
// gone from the deck.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  actions,
  installClock,
  logSpy,
  mergeTask,
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

describe('merge-on-github 93 nothing asks a session to merge', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it.each([
    ['ArrowRight', () => press('ArrowRight')],
    ['a right drag', () => swipe(card(), 300)],
    ['the Agree button', () => fireEvent.click(screen.getByRole('button', { name: 'Agree' }))],
  ])('%s sends no merge request and opens no hold sheet', async (_n, go) => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    go()
    await waitFor(() => expect(actions.markMerged).toHaveBeenCalledTimes(1))
    for (const [name, fn] of Object.entries(actions))
      if (name !== 'markMerged') expect(fn).not.toHaveBeenCalled()
    expect(logSpy.error).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: /hold to confirm/i })).toBeNull()
    expect(pageText()).not.toMatch(/hold 3 seconds|keep holding/i)
  })

  it('the merge card and its stamp never mention holding', () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    swipe(card(), 300, 0, true)
    expect(pageText()).not.toMatch(/hold/i)
  })

  it('the details sheet asks for no hold and no merge either', () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    press('ArrowUp')
    expect(screen.getByRole('dialog').textContent).not.toMatch(/hold/i)
    expect(actions.sendNote).not.toHaveBeenCalled()
  })
})

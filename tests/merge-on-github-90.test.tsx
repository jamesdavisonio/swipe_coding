// @vitest-environment jsdom
// merge-on-github 90: agreeing to a merge card (drag right, the Agree button, ArrowRight) marks the
// task merged at once and the card leaves; no sheet opens and nothing is held. The write's own
// effects (stage merged, need cleared, comment "Merged it.") are covered where markMerged is.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  actions,
  installClock,
  logSpy,
  mergeTask,
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

describe('merge-on-github 90 agreeing marks it merged', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it.each([
    ['dragging right past the threshold', () => swipe(card(), 300)],
    ['the Agree button', () => fireEvent.click(screen.getByRole('button', { name: 'Agree' }))],
    ['ArrowRight', () => press('ArrowRight')],
  ])('%s marks the task merged straight away and the card leaves', async (_n, go) => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    go()
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(actions.markMerged).toHaveBeenCalledWith(expect.objectContaining({ id: 'merge1' }))
    )
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('logs the mark_merged user action for the task', async () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    await waitFor(() =>
      expect(logSpy.event).toHaveBeenCalledWith(
        'user_action',
        expect.objectContaining({ action: 'mark_merged', target: 'merge1' })
      )
    )
  })

  it('a failed write brings the card back and is logged', async () => {
    actions.markMerged.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    await waitFor(() => expect(logSpy.error).toHaveBeenCalled())
    expect(logSpy.error.mock.calls[0][0]).toBe('feature_error')
    expect(logSpy.error.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        action: 'mark_merged',
        feature: 'web-threads',
        request_id: expect.any(String),
      })
    )
    expect(card().textContent).toContain('Merge PR #42 into main')
  })
})

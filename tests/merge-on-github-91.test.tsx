// @vitest-environment jsdom
// merge-on-github 91: while a merge card is dragged right its stamp reads "I merged it" and the
// line under it "Tells the session it's merged".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { installClock, mergeTask, renderAt, setBoard, swipe } from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

describe('merge-on-github 91 the merge stamp', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('says "I merged it" and what it tells the session while dragged right', () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    swipe(screen.getByTestId('deck-card'), 300, 0, true)
    const stamp = (screen.getByTestId('deck-stamp-yes').textContent ?? '').replace(/\s+/g, ' ')
    expect(stamp).toContain('I merged it')
    expect(stamp).toContain("Tells the session it's merged")
    expect(stamp).not.toContain('Hold')
  })
})

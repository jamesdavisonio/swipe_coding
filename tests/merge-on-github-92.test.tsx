// @vitest-environment jsdom
// merge-on-github 92: a merge card whose task has no web pr url shows no GitHub link, and agreeing
// still marks it merged.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  actions,
  installClock,
  mergeTask,
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

describe('merge-on-github 92 a merge card without a web url', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it.each([
    ['an empty url', ''],
    ['a url that is not a web address', 'not a url'],
    ['a script url', 'javascript:alert(1)'],
  ])('%s: no GitHub link, and agreeing still marks it merged', async (_n, url) => {
    setBoard({ tasks: [mergeTask({ pr: { number: 42, url } })] })
    renderAt('/', <Deck />)
    expect(screen.getByTestId('deck-card').textContent).toContain('Merge PR #42 into main')
    expect(screen.queryByRole('link', { name: /on GitHub/ })).toBeNull()
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull()
    press('ArrowRight')
    await waitFor(() =>
      expect(actions.markMerged).toHaveBeenCalledWith(expect.objectContaining({ id: 'merge1' }))
    )
    expect(screen.queryByTestId('deck-card')).toBeNull()
  })

  it('a task with no pr at all: the card renders, no link, agreeing marks it merged', async () => {
    setBoard({ tasks: [mergeTask({ pr: null })] })
    renderAt('/', <Deck />)
    expect(screen.getByTestId('deck-card').textContent).toContain('Merge the PR into main')
    expect(screen.queryByRole('link', { name: /on GitHub/ })).toBeNull()
    press('ArrowRight')
    await waitFor(() =>
      expect(actions.markMerged).toHaveBeenCalledWith(expect.objectContaining({ id: 'merge1' }))
    )
  })

  it('the Agree button works the same', async () => {
    setBoard({ tasks: [mergeTask({ pr: { number: 42, url: '' } })] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))
    await waitFor(() => expect(actions.markMerged).toHaveBeenCalledTimes(1))
  })
})

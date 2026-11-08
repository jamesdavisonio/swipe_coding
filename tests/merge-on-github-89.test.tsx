// @vitest-environment jsdom
// merge-on-github 89: a merge card shows "Open PR #<n> on GitHub" to the pull request's web url,
// in a new tab; using it neither answers nor removes the card.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  actions,
  installClock,
  logSpy,
  mergeTask,
  renderAt,
  setBoard,
  specTask,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const card = () => screen.getByTestId('deck-card')
const URL42 = 'https://github.com/x/site/pull/42'

describe('merge-on-github 89 the GitHub link on a merge card', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('links "Open PR #42 on GitHub" to the pr url, opening in a new tab', () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    const link = screen.getByRole('link', { name: 'Open PR #42 on GitHub' })
    expect(card().contains(link)).toBe(true)
    expect(link.getAttribute('href')).toBe(URL42)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('names the number of its own pull request', () => {
    setBoard({ tasks: [mergeTask({ pr: { number: 7, url: 'https://github.com/x/site/pull/7' } })] })
    renderAt('/', <Deck />)
    expect(screen.getByRole('link', { name: 'Open PR #7 on GitHub' })).toBeTruthy()
  })

  it('using the link answers nothing and leaves the card', () => {
    setBoard({ tasks: [mergeTask()] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('link', { name: 'Open PR #42 on GitHub' }))
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled()
    expect(logSpy.event).not.toHaveBeenCalledWith('user_action', expect.anything())
    expect(card().textContent).toContain('Merge PR #42 into main')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('other cards carry no such link', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    expect(screen.queryByRole('link', { name: /on GitHub/ })).toBeNull()
  })
})

// @vitest-environment jsdom
// swipe-deck 48: the board opens on the deck's first card; Threads moved to /threads; the other
// routes still work; the overview has no way to Threads (James, 2026-11-07: deeper detail is the
// card's own "Open in Claude" link).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../packages/web/src/App.tsx'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  MINUTE,
  installClock,
  makeTask,
  pageText,
  press,
  renderAt,
  setBoard,
  specTask,
} from './fixtures/web-threads-b2.tsx'
import { setThread } from './fixtures/web-threads-b3.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))
vi.mock('../packages/web/src/auth.tsx', () => ({
  AuthGate: ({ children }: { children: unknown }) => children,
}))

const open = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('swipe-deck 48 the deck is home', () => {
  installClock()
  afterEach(cleanup)

  it('shows the first card: type, time since asked, session, project and headline', () => {
    setBoard({
      tasks: [specTask({ updatedAt: Date.now() - 5 * MINUTE })],
    })
    open('/')
    const text = (screen.getByTestId('deck-card').textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toMatch(/\bspec\b/i)
    expect(text).toContain('5 min')
    expect(text).toContain('Order the replies')
    expect(text).toContain('kanban')
    expect(text).toContain('Start building: Order the replies')
    expect(screen.queryByRole('heading', { name: /^Threads/ })).toBeNull()
  })

  it('shows Threads exactly as before at /threads', () => {
    setBoard({ tasks: [specTask()] })
    open('/threads')
    expect(screen.getByRole('heading', { name: /^Threads/ })).toBeTruthy()
    expect(screen.queryByTestId('deck-card')).toBeNull()
  })

  it('still serves /t/t1 with its own content', () => {
    const task = makeTask('t1', { title: 'Build the cache', stage: 'build' })
    setBoard({ tasks: [task] })
    setThread(task)
    open('/t/t1')
    expect(window.location.pathname).toBe('/t/t1')
    expect(pageText()).toContain('Build the cache')
  })

  it.each([
    ['/projects', /^Projects$/],
    ['/p/p-kanban', /^kanban$/],
    ['/new', /^New task$/],
  ])('still serves %s with its own page, no redirect', (path, heading) => {
    setBoard({ tasks: [makeTask('t1', { stage: 'build' })] })
    open(path)
    expect(window.location.pathname).toBe(path)
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByTestId('deck-card')).toBeNull()
  })

  it('the overview has no link to Threads', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    press('ArrowDown')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Open threads' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
  })
})

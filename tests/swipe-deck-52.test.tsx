// @vitest-environment jsdom
// swipe-deck 52: with no cards the deck says "Nothing needs you." and lists the sessions working
// now (online agents bound to a task that is working).
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  HOUR,
  installClock,
  makeAgent,
  makeTask,
  pageText,
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

describe('swipe-deck 52 empty deck', () => {
  installClock()
  const working = (id: string, title: string, agentId: string, over = {}) =>
    makeTask(id, { title, stage: 'build', working: true, agentId, ...over })

  it('says Nothing needs you. and lists only sessions working now', () => {
    setBoard({
      tasks: [
        working('w1', 'Build the cache', 'on1'),
        working('w2', 'Offline session work', 'off1'),
        working('w3', 'Idle session work', 'on2', { working: false }),
      ],
      agents: [
        makeAgent('on1'),
        makeAgent('off1', { lastSeen: Date.now() - HOUR }),
        makeAgent('on2'),
      ],
    })
    renderAt('/', <Deck />)
    expect(pageText()).toContain('Nothing needs you.')
    expect(screen.queryByTestId('deck-card')).toBeNull()
    expect(pageText()).toContain('Build the cache')
    expect(pageText()).not.toContain('Offline session work')
    expect(pageText()).not.toContain('Idle session work')
  })

  it('says it with nobody working too', () => {
    setBoard({})
    renderAt('/', <Deck />)
    expect(pageText()).toContain('Nothing needs you.')
  })

  it('does not say it while a card waits', () => {
    setBoard({ tasks: [specTask()] })
    renderAt('/', <Deck />)
    expect(pageText()).not.toContain('Nothing needs you.')
    expect(screen.getByTestId('deck-card')).toBeTruthy()
  })
})

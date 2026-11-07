// @vitest-environment jsdom
// swipe-deck 51: up/ArrowUp opens details (example, parts, Open in Claude); down/ArrowDown opens
// the overview (tapping a project puts its cards first); every sheet closes four ways.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import {
  DECK_EXAMPLE,
  DECK_PARTS,
  fixTask,
  installClock,
  makeAgent,
  mergeTask,
  sessionComment,
  setComments,
  fixBriefText,
  specTask,
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

const REMOTE = 'https://claude.ai/code/session_abc123'
const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ')
const sheet = () => screen.getByRole('dialog')
const card = () => screen.getByTestId('deck-card')

describe('swipe-deck 51 details', () => {
  installClock()
  beforeEach(() => localStorage.clear())
  const board = (remoteUrl?: string | null) =>
    setBoard({
      tasks: [fixTask({ agentId: 'ag1' })],
      agents: [makeAgent('ag1', remoteUrl === undefined ? {} : { remoteUrl })],
    })

  it.each([
    ['ArrowUp', () => press('ArrowUp')],
    ['an upward swipe', () => swipe(card(), 0, -300)],
  ])('%s opens the example first, then the brief parts', (_n, go) => {
    board(REMOTE)
    renderAt('/', <Deck />)
    go()
    const t = text(sheet())
    const at = [DECK_EXAMPLE, ...Object.values(DECK_PARTS)].map((s) => t.indexOf(s))
    expect(at[0]).toBeGreaterThanOrEqual(0)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(at.every((i) => i >= 0)).toBe(true)
  })

  it('links "Open in Claude" to the bound session when the agent has one', () => {
    board(REMOTE)
    renderAt('/', <Deck />)
    press('ArrowUp')
    expect(within(sheet()).getByRole('link', { name: 'Open in Claude' }).getAttribute('href')).toBe(
      REMOTE
    )
  })

  it.each([[undefined], [null]])('has no "Open in Claude" link when remoteUrl is %s', (url) => {
    board(url)
    renderAt('/', <Deck />)
    press('ArrowUp')
    expect(screen.queryByRole('link', { name: 'Open in Claude' })).toBeNull()
  })

  it('the Details button opens it too', () => {
    board(REMOTE)
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(text(sheet())).toContain(DECK_EXAMPLE)
  })
})

describe('swipe-deck 51 overview', () => {
  installClock()
  beforeEach(() => localStorage.clear())
  const board = () =>
    setBoard({
      tasks: [mergeTask(), fixTask({ projectId: 'p-site' })],
    })

  it.each([
    ['ArrowDown', () => press('ArrowDown')],
    ['a downward swipe', () => swipe(card(), 0, 300)],
    [
      'the Overview button',
      () => fireEvent.click(screen.getByRole('button', { name: 'Overview' })),
    ],
  ])('%s opens what is waiting, by type and by project', (_n, go) => {
    board()
    renderAt('/', <Deck />)
    go()
    const t = text(sheet())
    expect(t).toContain('kanban')
    expect(t).toContain('website')
    expect(t).toContain('1 merge')
    expect(t).toContain('1 fix')
  })

  it('tapping a project puts all its cards first', () => {
    board()
    renderAt('/', <Deck />)
    expect(text(card())).toContain('Merge PR #42 into main')
    press('ArrowDown')
    fireEvent.click(within(sheet()).getByRole('button', { name: /website/ }))
    expect(text(card())).toContain('Mend the export')
  })
})

describe('swipe-deck 51 spec card from the thread', () => {
  installClock()
  beforeEach(() => localStorage.clear())
  it('takes its headline from the Yes line and its example from the spec brief', () => {
    setBoard({ tasks: [specTask()] })
    setComments('spec1', [sessionComment('spec1', fixBriefText('Order every reply', 'spec'))])
    renderAt('/', <Deck />)
    expect(text(card())).toContain('Order every reply')
    expect(text(card())).not.toContain('Start building')
    press('ArrowUp')
    expect(text(sheet())).toContain(DECK_EXAMPLE)
  })
})

describe('swipe-deck 51 closing sheets', () => {
  installClock()
  beforeEach(() => localStorage.clear())
  const opened = [
    ['details', 'ArrowUp', [0, 300]],
    ['overview', 'ArrowDown', [0, -300]],
  ] as const

  it.each(opened)('the %s sheet closes with its Close button', (_n, key) => {
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    press(key)
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(opened)('the %s sheet closes with Escape', (_n, key) => {
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    press(key)
    press('Escape')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(opened)('the %s sheet closes with a drag back the way it came', (_n, key, [dx, dy]) => {
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    press(key)
    swipe(sheet(), dx, dy)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(opened)('the %s sheet closes with a tap on the backdrop', (_n, key) => {
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    press(key)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a details sheet scrolled down scrolls first: a downward drag leaves it open', () => {
    setBoard({ tasks: [fixTask()] })
    renderAt('/', <Deck />)
    press('ArrowUp')
    const body = screen.getByTestId('sheet-scroll')
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: 120 })
    swipe(body, 0, 300)
    expect(screen.getByRole('dialog')).toBeTruthy()
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: 0 })
    swipe(body, 0, 300)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

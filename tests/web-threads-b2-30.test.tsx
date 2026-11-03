// @vitest-environment jsdom
// web-threads B2, shared criterion 30 on Threads and the bottom nav: every control is reachable
// by keyboard and has an accessible name; chips expose aria-pressed, nav aria-current. (The
// visible focus ring is CSS that jsdom cannot render; it is checked at review.)
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  actions,
  chip,
  installClock,
  makeTask,
  makeTodo,
  openButton,
  renderAt,
  setBoard,
  where,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

// One row of every kind, so every control type is on screen.
const fullBoard = () =>
  setBoard({
    tasks: [
      makeTask('t-spec', { title: 'Spec the search', needs: { kind: 'spec' } }),
      makeTask('t-q', {
        projectId: 'p-site',
        title: 'Pick a font',
        stage: 'build',
        unread: true,
        needs: { kind: 'question', options: [{ key: 'A', label: 'Inter' }] },
      }),
      makeTask('t-pr', {
        projectId: 'p-site',
        title: 'Ship the footer',
        stage: 'pr',
        needs: { kind: 'pr' },
        pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
      }),
      makeTask('t-ad', {
        title: 'Check the deploy',
        stage: 'after_deploy',
        afterDeploy: ['Open the site'],
        needs: { kind: 'after_deploy' },
      }),
      makeTask('t-quiet', { title: 'Build the cache', stage: 'build' }),
    ],
    todos: [makeTodo('todo')],
  })

const controls = () =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]'
    )
  ).filter((el) => el.getAttribute('tabindex') !== '-1')

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let i = 0; i < 60 && document.activeElement !== target; i++) await user.tab()
  expect(document.activeElement).toBe(target)
}

describe('B2-30 keyboard and names on Threads', () => {
  installClock()

  it('reaches every control with Tab', async () => {
    fullBoard()
    renderAt('/', <Threads />)
    const user = userEvent.setup()
    const reached = new Set<Element>()
    for (let i = 0; i < 60; i++) {
      await user.tab()
      const el = document.activeElement
      if (!el || el === document.body || reached.has(el)) break
      reached.add(el)
    }
    const all = controls()
    expect(all.length).toBeGreaterThan(10)
    expect(all.filter((el) => !reached.has(el)).map((el) => el.outerHTML)).toEqual([])
  })

  it('gives every button and link an accessible name', () => {
    fullBoard()
    renderAt('/', <Threads />)
    expect(screen.queryAllByRole('button', { name: '' })).toEqual([])
    expect(screen.queryAllByRole('link', { name: '' })).toEqual([])
  })

  it('exposes aria-pressed on every chip and aria-current on the nav', () => {
    fullBoard()
    renderAt('/', <Threads />)
    for (const name of ['All', 'kanban', 'website', 'calendar']) {
      const c = screen.getByRole('button', { name: new RegExp(`^${name}`) })
      expect(['true', 'false']).toContain(c.getAttribute('aria-pressed'))
    }
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const current = nav.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toMatch(/^Threads/)
  })

  it('filters by project with the keyboard', async () => {
    fullBoard()
    renderAt('/', <Threads />)
    const user = userEvent.setup()
    await tabTo(user, chip('website'))
    await user.keyboard('{Enter}')
    expect(chip('website').getAttribute('aria-pressed')).toBe('true')
    expect(where()).toBe('/?project=p-site')
  })

  it('opens a thread with the keyboard', async () => {
    fullBoard()
    renderAt('/', <Threads />)
    const user = userEvent.setup()
    await tabTo(user, openButton('Pick a font'))
    await user.keyboard('{Enter}')
    expect(where()).toBe('/t/t-q')
    expect(actions.markRead).toHaveBeenCalledWith(expect.objectContaining({ id: 't-q' }))
  })
})

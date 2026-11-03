// @vitest-environment jsdom
// web-threads B2, criterion 7: project chips filter Threads; the tapped chip is pressed, each
// chip shows its own needs-you count, and "All" resets the filter.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  installClock,
  chip,
  chips,
  logSpy,
  makeTask,
  makeTodo,
  openButton,
  queryOpenButton,
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

// kanban: one spec need + one open todo (2); website: three needs (3); calendar: nothing.
const board = () =>
  setBoard({
    tasks: [
      makeTask('k1', { title: 'Spec the search', needs: { kind: 'spec' } }),
      makeTask('k2', { title: 'Build the cache', stage: 'build' }),
      makeTask('s1', { projectId: 'p-site', title: 'Pick a font', needs: { kind: 'question' } }),
      makeTask('s2', {
        projectId: 'p-site',
        title: 'Ship the footer',
        stage: 'pr',
        needs: { kind: 'pr' },
      }),
      makeTask('s3', {
        projectId: 'p-site',
        title: 'Check the deploy',
        stage: 'after_deploy',
        afterDeploy: ['Look at it'],
        needs: { kind: 'after_deploy' },
      }),
      makeTask('c1', {
        projectId: 'p-cal',
        title: 'Tidy the calendar',
        stage: 'do',
        type: 'chore',
      }),
    ],
    todos: [makeTodo('todo-k'), makeTodo('todo-c-done', { projectId: 'p-cal', done: true })],
  })

const kanbanTitles = ['Spec the search', 'Build the cache']
const siteTitles = ['Pick a font', 'Ship the footer', 'Check the deploy']

describe('B2-7 project chips', () => {
  installClock()

  it('shows All first, then one chip per project, all exposing aria-pressed; All is pressed', () => {
    board()
    renderAt('/', <Threads />)
    const all = chips()
    expect(all).toHaveLength(4)
    expect(all[0].textContent?.trim()).toMatch(/^All/)
    expect(all[0].getAttribute('aria-pressed')).toBe('true')
    for (const name of ['kanban', 'website', 'calendar'])
      expect(chip(name).getAttribute('aria-pressed')).toBe('false')
  })

  it("shows each project's own needs-you count, and none when it is zero", () => {
    board()
    renderAt('/', <Threads />)
    expect(chip('All').textContent).toMatch(/5/)
    expect(chip('kanban').textContent).toMatch(/2/)
    expect(chip('website').textContent).toMatch(/3/)
    expect(chip('calendar').textContent).not.toMatch(/\d/)
  })

  it('tapping a project shows only its rows, presses its chip and logs the filter', async () => {
    board()
    renderAt('/', <Threads />)
    await userEvent.setup().click(chip('website'))
    for (const title of siteTitles) expect(openButton(title)).toBeTruthy()
    for (const title of kanbanTitles) expect(queryOpenButton(title)).toBeNull()
    expect(screen.queryByRole('button', { name: /^For James · kanban/ })).toBeNull()
    expect(chip('website').getAttribute('aria-pressed')).toBe('true')
    expect(chip('All').getAttribute('aria-pressed')).toBe('false')
    expect(where()).toBe('/?project=p-site')
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({ feature: 'web-threads', action: 'filter', target: 'p-site' })
    )
  })

  it('opening /?project=<id> starts filtered to that project', () => {
    board()
    renderAt('/?project=p-kanban', <Threads />)
    for (const title of kanbanTitles) expect(openButton(title)).toBeTruthy()
    for (const title of siteTitles) expect(queryOpenButton(title)).toBeNull()
    expect(chip('kanban').getAttribute('aria-pressed')).toBe('true')
  })

  it('All resets the filter, clears it from the URL and logs it', async () => {
    board()
    renderAt('/?project=p-site', <Threads />)
    await userEvent.setup().click(chip('All'))
    for (const title of [...kanbanTitles, ...siteTitles, 'Tidy the calendar'])
      expect(openButton(title)).toBeTruthy()
    expect(chip('All').getAttribute('aria-pressed')).toBe('true')
    expect(chip('website').getAttribute('aria-pressed')).toBe('false')
    expect(where()).not.toMatch(/project=/)
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({ feature: 'web-threads', action: 'filter', target: 'all' })
    )
  })
})

// @vitest-environment jsdom
// web-threads B5, criterion 21: the Projects screen. Heading and "<N> sessions live"; one link per
// project (useProjects order) to /p/<id>, named by the project, showing its host, the live dot's
// text ("session live" / "no session" from agents.lastSeen within the stale window) and the
// counts: need you (only above zero, the Threads chip's count), live, done this week, for James
// (open todos, only above zero).
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Projects from '../packages/web/src/pages/Projects.tsx'
import {
  DAY,
  HOUR,
  NOW,
  installClock,
  makeTask,
  makeTodo,
  where,
} from './fixtures/web-threads-b2.tsx'
import {
  ONLINE,
  JUST_INSIDE_WEEK,
  JUST_OUTSIDE_WEEK,
  STALE,
  agent,
  b5Text,
  hasPhrase,
  hrefsTo,
  pastWeek,
  projectCardText,
  renderB5,
  setB5Board,
} from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b5.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

// kanban: online agent; 2 live (one needs James), 1 done this week, 1 done long ago, a For James
// task (never counted as live), 2 open todos and 1 done todo.
// website: no agent; a PR waiting on James; nothing else.
// calendar: only a stale agent; nothing at all.
const fullBoard = () =>
  setB5Board({
    tasks: [
      makeTask('k-spec', { title: 'Spec the search', stage: 'spec', needs: { kind: 'spec' } }),
      makeTask('k-build', { title: 'Build the cache', stage: 'build' }),
      makeTask('k-done', { title: 'Ship the nav', stage: 'done', doneAt: NOW - 2 * DAY }),
      makeTask('k-old', { title: 'Old work', stage: 'done', doneAt: NOW - pastWeek(3) }),
      makeTask('k-fj', { type: 'for_james', title: 'For James', stage: 'do' }),
      makeTask('s-pr', {
        projectId: 'p-site',
        type: 'bugfix',
        title: 'Fix the header',
        stage: 'pr',
        needs: { kind: 'pr' },
      }),
    ],
    todos: [
      makeTodo('td1', { body: 'Rotate the key', createdAt: NOW - HOUR }),
      makeTodo('td2', { body: 'Check the logs', createdAt: NOW - 2 * HOUR }),
      makeTodo('td3', { body: 'Old chore', done: true, doneAt: NOW - DAY }),
    ],
    agents: [
      agent('a-k', 'p-kanban', ONLINE),
      agent('a-k2', 'p-kanban', ONLINE),
      agent('a-c', 'p-cal', STALE),
    ],
  })

const open = () =>
  renderB5('/projects', { '/projects': <Projects />, '/p/:projectId': <h1>A project</h1> })

describe('B5-21 the Projects header', () => {
  installClock()

  it('is headed Projects', () => {
    fullBoard()
    open()
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeTruthy()
  })

  it('counts the projects with an online agent (two agents in one project count once)', () => {
    fullBoard()
    open()
    expect(hasPhrase(b5Text(), '1 session live')).toBe(true)
    expect(b5Text()).not.toMatch(/\d+ sessions live/)
  })

  it('says "<N> sessions live" for more than one', () => {
    setB5Board({ agents: [agent('a-k', 'p-kanban', ONLINE), agent('a-s', 'p-site', ONLINE)] })
    open()
    expect(hasPhrase(b5Text(), '2 sessions live')).toBe(true)
  })

  it('says "0 sessions live" when every agent is stale', () => {
    setB5Board({ agents: [agent('a-c', 'p-cal', STALE)] })
    open()
    expect(hasPhrase(b5Text(), '0 sessions live')).toBe(true)
  })

  it('an agent seen just past AGENT_STALE_MS ago is not live and not counted', () => {
    setB5Board({
      agents: [agent('a-k', 'p-kanban', ONLINE), agent('a-s', 'p-site', STALE)],
    })
    open()
    expect(hasPhrase(b5Text(), '1 session live')).toBe(true)
    expect(projectCardText('p-kanban')).toContain('session live')
    expect(projectCardText('p-site')).toContain('no session')
    expect(projectCardText('p-site')).not.toContain('session live')
  })
})

describe('B5-21 one card per project', () => {
  installClock()

  it('links each project to /p/<id>, in the order useProjects returns', () => {
    fullBoard()
    open()
    expect(hrefsTo('/p/')).toEqual(['/p/p-kanban', '/p/p-site', '/p/p-cal'])
  })

  it('names each link by the project name and shows its host', () => {
    fullBoard()
    open()
    for (const [id, name, host] of [
      ['p-kanban', 'kanban', 'desk-pc'],
      ['p-site', 'website', 'laptop'],
      ['p-cal', 'calendar', 'studio-mac'],
    ]) {
      const link = screen.getByRole('link', { name: new RegExp(name) })
      expect(link.getAttribute('href')).toBe(`/p/${id}`)
      expect(projectCardText(id)).toContain(host)
    }
  })

  it('shows "session live" only for a project with an agent seen within the stale window', () => {
    fullBoard()
    open()
    expect(projectCardText('p-kanban')).toContain('session live')
    expect(projectCardText('p-kanban')).not.toContain('no session')
    expect(projectCardText('p-site')).toContain('no session')
    expect(projectCardText('p-site')).not.toContain('session live')
    expect(projectCardText('p-cal')).toContain('no session')
    expect(projectCardText('p-cal')).not.toContain('session live')
  })

  it('counts need you, live, done this week and for James on a busy project', () => {
    fullBoard()
    open()
    const text = projectCardText('p-kanban')
    // 1 task waiting on its spec + 2 open todos, as on the Threads chip.
    expect(hasPhrase(text, '3 need you')).toBe(true)
    // spec + build; the For James task and the done ones are not live.
    expect(hasPhrase(text, '2 live')).toBe(true)
    // done 2 days ago; the one done 3 days past DONE_VISIBLE_MS is not this week.
    expect(hasPhrase(text, '1 done this week')).toBe(true)
    // open todos only.
    expect(hasPhrase(text, '2 for James')).toBe(true)
  })

  it('leaves out need you and for James when they are zero, but always shows live and done', () => {
    fullBoard()
    open()
    const site = projectCardText('p-site')
    expect(hasPhrase(site, '1 need you')).toBe(true)
    expect(hasPhrase(site, '1 live')).toBe(true)
    expect(hasPhrase(site, '0 done this week')).toBe(true)
    expect(site).not.toMatch(/\d+ for James/)

    const cal = projectCardText('p-cal')
    expect(cal).not.toMatch(/need you/)
    expect(cal).not.toMatch(/\d+ for James/)
    expect(hasPhrase(cal, '0 live')).toBe(true)
    expect(hasPhrase(cal, '0 done this week')).toBe(true)
  })

  it('counts a task done just inside DONE_VISIBLE_MS, not one done just outside it', () => {
    setB5Board({
      tasks: [
        makeTask('k-out', { title: 'Just out', stage: 'done', doneAt: NOW - JUST_OUTSIDE_WEEK }),
        makeTask('k-in', { title: 'Just in', stage: 'done', doneAt: NOW - JUST_INSIDE_WEEK }),
      ],
    })
    open()
    const text = projectCardText('p-kanban')
    expect(hasPhrase(text, '1 done this week')).toBe(true)
    expect(hasPhrase(text, '0 live')).toBe(true)
  })

  it('does not count a need on a task that finished more than a week ago', () => {
    setB5Board({
      tasks: [
        makeTask('k-old', {
          title: 'Old work',
          stage: 'done',
          doneAt: NOW - pastWeek(3),
          needs: { kind: 'pr' },
        }),
      ],
    })
    open()
    expect(projectCardText('p-kanban')).not.toMatch(/need you/)
  })

  it('opens the project when its card is tapped', async () => {
    fullBoard()
    open()
    await userEvent.setup().click(screen.getByRole('link', { name: /website/ }))
    expect(where()).toBe('/p/p-site')
  })
})

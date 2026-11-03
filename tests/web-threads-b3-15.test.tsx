// @vitest-environment jsdom
// web-threads B3, criterion 15: the thread header. The clock button opens the History sheet;
// Back returns to Threads with the project filter James came from (Threads passes it as
// navigation state); the header shows the title and "<project> · <stage>", plus "session live"
// while one of the project's agents is online and the task is not done. No bottom nav here.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AGENT_STALE_MS, type AgentDoc, type Task } from '../packages/shared/src/index.ts'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  MINUTE,
  NOW,
  chip,
  installClock,
  makeTask,
  openButton,
  where,
} from './fixtures/web-threads-b2.tsx'
import { renderThread, setThread, threadText } from './fixtures/web-threads-b3.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const font = makeTask('t1', {
  projectId: 'p-site',
  title: 'Pick a font',
  stage: 'build',
  needs: { kind: 'question', options: [{ key: 'A', label: 'Inter' }] },
})

const agent = (projectId: string, lastSeen: number): AgentDoc => ({
  id: `agent-${projectId}`,
  projectId,
  hostname: 'pc',
  cwd: `C:/code/${projectId}`,
  pid: 1234,
  claudeSessionId: null,
  startedAt: NOW - 60 * MINUTE,
  lastSeen,
})

const back = () => screen.getByRole('button', { name: 'Back to threads' })

describe('B3-15 history', () => {
  installClock()

  it('Decision history opens the History sheet for this task, and it closes', async () => {
    setThread(font)
    renderThread('/t/t1', <Thread />)
    const user = userEvent.setup()
    expect(screen.queryByRole('dialog', { name: 'History sheet' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Decision history' }))
    const sheet = screen.getByRole('dialog', { name: 'History sheet' })
    expect(sheet.textContent).toContain('history: Pick a font')
    expect(where()).toBe('/t/t1')
    await user.click(screen.getByRole('button', { name: 'Close history' }))
    expect(screen.queryByRole('dialog', { name: 'History sheet' })).toBeNull()
  })
})

describe('B3-15 back to Threads', () => {
  installClock()

  it.each([
    ['the filtered Threads path it came from', { from: '/?project=p-site' }, '/?project=p-site'],
    ['/ when it came from all projects', { from: '/' }, '/'],
    ['/ when opened directly (no state)', undefined, '/'],
    ['/ when from is not an app path', { from: 'https://example.com/' }, '/'],
    ['/ when from is not a string', { from: 42 }, '/'],
  ])('goes to %s', async (_name, state, expected) => {
    setThread(font)
    renderThread({ pathname: '/t/t1', state }, <Thread />)
    await userEvent.setup().click(back())
    expect(where()).toBe(expected)
  })

  it('round trip: a filtered Threads → thread → Back keeps the project filter', async () => {
    const other = makeTask('t2', { title: 'Build the cache', stage: 'build' })
    setThread(font, { tasks: [font, other] })
    renderThread('/?project=p-site', <Thread />, <Threads />)
    const user = userEvent.setup()
    expect(chip('website').getAttribute('aria-pressed')).toBe('true')
    await user.click(openButton('Pick a font'))
    expect(where()).toBe('/t/t1')
    expect(screen.getByRole('heading', { name: 'Pick a font' })).toBeTruthy()
    await user.click(back())
    expect(where()).toBe('/?project=p-site')
    expect(chip('website').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: /^Build the cache/ })).toBeNull()
  })
})

describe('B3-15 header', () => {
  installClock()

  const header = (task: Task, agents: AgentDoc[] = []) => {
    setThread(task, { agents })
    renderThread('/t/t1', <Thread />)
  }

  it('shows the title as the heading and "<project> · <stage>" under it', () => {
    header(font)
    expect(screen.getByRole('heading', { name: 'Pick a font' })).toBeTruthy()
    expect(threadText()).toContain('website · Question for you')
    expect(threadText()).not.toContain('session live')
  })

  it('adds "session live" while one of the project\'s agents is online', () => {
    header(font, [agent('p-site', NOW - MINUTE)])
    expect(threadText()).toContain('website · Question for you · session live')
  })

  it.each([
    ['the agent is stale', font, [agent('p-site', NOW - AGENT_STALE_MS - MINUTE)]],
    ['only another project has an agent', font, [agent('p-kanban', NOW - MINUTE)]],
    [
      'the task is done',
      makeTask('t1', { ...font, stage: 'done', needs: null, doneAt: NOW - MINUTE }),
      [agent('p-site', NOW - MINUTE)],
    ],
  ])('no "session live" when %s', (_name, task, agents) => {
    header(task, agents)
    expect(threadText()).not.toContain('session live')
  })

  it('a done task reads "<project> · Done"', () => {
    header({ ...font, stage: 'done', needs: null, doneAt: NOW - MINUTE })
    expect(threadText()).toContain('website · Done')
  })

  it('the thread view has no bottom nav', () => {
    header(font)
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })
})

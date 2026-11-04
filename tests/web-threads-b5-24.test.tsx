// @vitest-environment jsdom
// web-threads B5, criterion 24: a project with no live agent. New task still saves (the next
// session announces the queued task, which is existing agent behaviour), and the queued task's
// thread says it is waiting for a session, with no "session live". That the stored task is
// queued whether or not a session is live is tested in the emulator
// (tests/emulator/web-threads-b5-23.test.ts, "B5-24").
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AgentDoc } from '../packages/shared/src/index.ts'
import NewTask from '../packages/web/src/pages/NewTask.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { installClock, makeTask, where } from './fixtures/web-threads-b2.tsx'
import { renderThread, setThread, threadText } from './fixtures/web-threads-b3.tsx'
import {
  ONLINE,
  STALE,
  agent,
  b5Actions,
  renderB5,
  setB5Board,
} from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b5.tsx')).dataModule()
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

const NO_LIVE_AGENT: [string, AgentDoc[]][] = [
  ['no agent at all', []],
  ['only a stale agent', [agent('a-c', 'p-cal', STALE)]],
  ['agents live only in other projects', [agent('a-k', 'p-kanban', ONLINE)]],
]

describe('B5-24 New task for a project with no live session', () => {
  installClock()

  it.each(NO_LIVE_AGENT)('with %s, Queue task saves and returns to Threads', async (_n, agents) => {
    setB5Board({ agents })
    renderB5('/new?project=p-cal', { '/new': <NewTask /> })
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: /^Title/ }), 'Plan the week view')
    await user.click(screen.getByRole('button', { name: 'Queue task' }))
    expect(b5Actions.createTask).toHaveBeenCalledTimes(1)
    expect(b5Actions.createTask.mock.calls[0][0]).toBe('p-cal')
    expect(b5Actions.createTask.mock.calls[0][1]).toEqual(
      expect.objectContaining({ title: 'Plan the week view' })
    )
    await waitFor(() => expect(where()).toBe('/'))
  })
})

describe('B5-24 the queued thread with no live session', () => {
  installClock()

  it.each(NO_LIVE_AGENT)('with %s, says it waits for a session', (_n, agents) => {
    const task = makeTask('t1', { projectId: 'p-cal', title: 'Plan the week view' })
    setThread(task, { agents })
    renderThread('/t/t1', <Thread />)
    expect(threadText()).toContain('Queued by you · waiting for a session in calendar')
    expect(threadText()).not.toContain('session live')
  })
})

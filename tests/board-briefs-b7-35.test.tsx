// @vitest-environment jsdom
// board-briefs B7, criterion 35 (the screen half): a task the session finished with a summary ends
// its thread with a Done message carrying that summary, rendered as a brief card when it is one;
// the thread header and the project's Done tab show the task as done. Writing the Done message
// and marking the task unread is the agent's half (tests/emulator/board-briefs-b7-35.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { Comment, Task } from '../packages/shared/src/index.ts'
import Project from '../packages/web/src/pages/Project.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { DAY, MINUTE, NOW, installClock, makeTask } from './fixtures/web-threads-b2.tsx'
import { renderThread, sessionMsg, threadText } from './fixtures/web-threads-b3.tsx'
import { renderB5, taskCard, textIn } from './fixtures/web-threads-b5.tsx'
import { setB6 } from './fixtures/web-threads-b6.tsx'
import { PARTS, briefMessage, expectCard } from './fixtures/board-briefs-b7.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const PLAIN = 'Replies now show in the order they were sent.'

// A task the session just finished with `summary`, unread, and its thread ending in the Done
// message the agent writes.
const finished = (summary: string): { task: Task; comments: Comment[] } => ({
  task: makeTask('t1', {
    title: 'Order the replies',
    stage: 'done',
    doneAt: NOW - 5 * MINUTE,
    updatedAt: NOW - 5 * MINUTE,
    summary,
    unread: true,
  }),
  comments: [
    sessionMsg('c1', 'info', 'Opening the PR.', NOW - DAY),
    sessionMsg('c2', 'done', summary, NOW - 5 * MINUTE),
  ],
})

const showThread = (summary: string) => {
  const { task, comments } = finished(summary)
  setB6(task, { comments })
  renderThread('/t/t1', <Thread />)
}

describe('B7-35 the thread ends with the Done message', () => {
  installClock()

  it('renders a summary brief in the Done message as a Summary card, last in the thread', () => {
    showThread(briefMessage('summary', { before: 'All done.' }))
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeTruthy()
    expectCard(document.body, PARTS.summary)
    const text = threadText()
    const label = text.indexOf('Done · 5 min')
    expect(label).toBeGreaterThan(text.indexOf('Opening the PR.'))
    expect(text.indexOf('All done.')).toBeGreaterThan(label)
    expect(text.indexOf(PARTS.summary.origin)).toBeGreaterThan(label)
    expect(text).toContain('kanban · Done')
  })

  it('shows a plain summary in the Done message as it is, with the task done in the header', () => {
    showThread(PLAIN)
    const text = threadText()
    expect(text.indexOf(PLAIN)).toBeGreaterThan(text.indexOf('Done · 5 min'))
    expect(text).toContain('kanban · Done')
    expect(screen.queryByRole('heading', { name: 'Summary' })).toBeNull()
  })

  it("lists the finished task on its project's Done tab", () => {
    const { task } = finished(PLAIN)
    setB6(task)
    renderB5('/p/p-kanban?tab=done', { '/p/:projectId': <Project /> })
    expect(textIn(taskCard('t1'))).toContain('Order the replies')
  })
})

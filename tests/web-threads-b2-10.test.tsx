// @vitest-environment jsdom
// web-threads B2, criterion 10 (with B1 criterion 2): a task done more than 7 days ago is
// absent from Threads; a more recent done task still shows.
import { describe, expect, it, vi } from 'vitest'
import { DONE_VISIBLE_MS } from '../packages/shared/src/index.ts'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { needsCount, threadRows } from '../packages/web/src/lib/threads.ts'
import {
  DAY,
  NOW,
  installClock,
  makeTask,
  openButton,
  pageText,
  queryOpenButton,
  renderAt,
  rowText,
  setBoard,
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

const doneAgo = (id: string, ms: number, title = `Done ${id}`) =>
  makeTask(id, { title, stage: 'done', doneAt: NOW - ms, updatedAt: NOW - ms })

const taskIds = (tasks: ReturnType<typeof makeTask>[]) =>
  threadRows({ tasks, todos: [], filter: 'all', now: NOW }).map((r) =>
    r.kind === 'task' ? r.task.id : r.projectId
  )

describe('B2-10 threadRows drops tasks done more than 7 days ago', () => {
  it('keeps a task done 6 days ago and drops one done 8 days ago', () => {
    expect(taskIds([doneAgo('recent', 6 * DAY), doneAgo('old', 8 * DAY)])).toEqual(['recent'])
  })

  it('keeps a task done exactly 7 days ago and drops it a millisecond later', () => {
    expect(taskIds([doneAgo('edge', DONE_VISIBLE_MS)])).toEqual(['edge'])
    expect(taskIds([doneAgo('past', DONE_VISIBLE_MS + 1)])).toEqual([])
  })

  it('does not count a hidden done task, even one left with a need', () => {
    const stale = { ...doneAgo('old', 8 * DAY), needs: { kind: 'spec' as const } }
    expect(needsCount({ tasks: [stale], todos: [], now: NOW })).toBe(0)
  })
})

describe('B2-10 Threads screen', () => {
  installClock()

  it('shows the recent done task as Done and leaves the old one out', () => {
    setBoard({
      tasks: [
        doneAgo('recent', 2 * DAY, 'Shipped the footer'),
        doneAgo('old', 10 * DAY, 'Shipped the header'),
      ],
    })
    renderAt('/', <Threads />)
    expect(rowText(openButton('Shipped the footer'))).toContain('kanban · Done')
    expect(queryOpenButton('Shipped the header')).toBeNull()
    expect(pageText()).not.toContain('Shipped the header')
  })
})

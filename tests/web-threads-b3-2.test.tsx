// @vitest-environment jsdom
// web-threads B1 criterion 2, the "opened by id" clause (owned by B3): a done task that left
// the lists more than 7 days ago still opens and renders at /t/:id.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Thread from '../packages/web/src/pages/Thread.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { DAY, NOW, installClock, makeTask, queryOpenButton } from './fixtures/web-threads-b2.tsx'
import {
  jamesMsg,
  queryComposer,
  renderThread,
  sessionMsg,
  setThread,
  threadText,
} from './fixtures/web-threads-b3.tsx'

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

const oldDone = (age: number) =>
  makeTask('t-old', {
    title: 'Old search work',
    stage: 'done',
    doneAt: NOW - age,
    updatedAt: NOW - age,
  })
const comments = (age: number) =>
  [
    sessionMsg('c1', 'done', 'Shipped and verified', NOW - age),
    jamesMsg('c2', 'Thanks, nice work', NOW - age + 1, { handledAt: NOW - age + 2 }),
  ].map((c) => ({ ...c, taskId: 't-old' }))

describe('B3-2 a done task opened by id', () => {
  installClock()

  it.each([
    ['8 days', 8 * DAY, 'Done · 8 d'],
    ['30 days', 30 * DAY, 'Done · 30 d'],
    ['a year', 365 * DAY, 'Done · 365 d'],
  ])('finished %s ago renders its thread', (_name, age, label) => {
    setThread(oldDone(age), { comments: comments(age) })
    renderThread('/t/t-old', <Thread />)
    expect(screen.getByRole('heading', { name: 'Old search work' })).toBeTruthy()
    const text = threadText()
    expect(text).toContain('Shipped and verified')
    expect(text).toContain(label)
    expect(text).toContain('Thanks, nice work')
    expect(text).not.toContain('This task no longer exists.')
    expect(screen.queryByRole('status', { name: 'Loading thread' })).toBeNull()
    expect(queryComposer()).toBeNull()
  })

  it('the same task is not listed on Threads, yet opens by id', () => {
    setThread(oldDone(30 * DAY), { comments: comments(30 * DAY) })
    const { unmount } = renderThread('/', <Thread />, <Threads />)
    expect(queryOpenButton('Old search work')).toBeNull()
    unmount()
    renderThread('/t/t-old', <Thread />, <Threads />)
    expect(screen.getByRole('heading', { name: 'Old search work' })).toBeTruthy()
  })
})
